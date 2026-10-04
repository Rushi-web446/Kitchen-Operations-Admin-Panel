import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  OrderStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { KitchenUnitProvisioningService } from '../kitchen/kitchen-unit-provisioning.service';
import { CreateOrderDto, OrderCombinationDto } from './dto/create-order.dto';
import {
  assertCalendarDate,
  formatCalendarDate,
  formatDatabaseTime,
  getWeekday,
  toDatabaseDate,
  toDatabaseTime,
} from './calendar-time';
import { CutoffCalculatorService } from './cutoff-calculator.service';
import { OrderPlanningService } from './order-planning.service';
import { OrderPricingService } from './order-pricing.service';
import { ORDER_RESPONSE_SELECT, toOrderResponse } from './order-response';

type GroupLink = {
  optionGroup: {
    id: number;
    required: boolean;
    minSelections: number;
    maxSelections: number | null;
    usesPortions: boolean;
    options: Array<{
      optionId: number;
      option: { id: number; name: string; active: boolean };
      portions: Array<{
        id: number;
        portionSizeId: number;
        portionSize: { name: string; active: boolean };
        extraPrice: Prisma.Decimal;
      }>;
    }>;
  };
};

type ValidatedOption = {
  id: number;
  optionGroupId: number;
  portionId: number | null;
  name: string;
  price: Prisma.Decimal;
  portionName: string | null;
  portionExtraPrice: Prisma.Decimal;
};

type ValidatedCombination = {
  quantity: number;
  unitPrice: Prisma.Decimal;
  totalPrice: Prisma.Decimal;
  options: ValidatedOption[];
};

type PreparedOrder = {
  employeeId: number;
  companyId: number;
  status: OrderStatus;
  deliveryDate: Date;
  deliveryTime: Date;
  deliveryAddressSnapshot: Prisma.InputJsonValue;
  packaging: string;
  driverInstructionsSnapshot: string | null;
  totalAmount: Prisma.Decimal;
  cutoffAt: Date;
  plannedDispatchReadyAt: Date;
  plannedKitchenReadyAt: Date;
  lineCreates: Prisma.OrderLineCreateWithoutOrderInput[];
  quoteLines: Array<{
    dishId: number;
    dishName: string;
    quantity: number;
    dishUnitPrice: string;
    lineTotal: string;
    combinations: Array<{
      quantity: number;
      unitPrice: string;
      totalPrice: string;
      options: Array<{ id: number; name: string; unitPrice: string; portionName: string | null }>;
    }>;
  }>;
};

@Injectable()
export class OrderCreationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cutoffCalculator: CutoffCalculatorService,
    private readonly planningService: OrderPlanningService,
    private readonly pricingService: OrderPricingService,
    private readonly kitchenUnitProvisioning: KitchenUnitProvisioningService,
  ) {}

  async create(dto: CreateOrderDto, actorRole: Role, now = new Date()) {
    if (actorRole !== Role.ADMIN) throw new ForbiddenException('Only an admin may create orders');
    return this.prisma.$transaction(async (tx) => {
      const prepared = await this.prepare(dto, now, tx);
      const created = await tx.order.create({
        data: {
          status: prepared.status,
          deliveryDate: prepared.deliveryDate,
          deliveryTime: prepared.deliveryTime,
          deliveryAddressSnapshot: prepared.deliveryAddressSnapshot,
          packaging: prepared.packaging,
          driverInstructionsSnapshot: prepared.driverInstructionsSnapshot,
          totalAmount: prepared.totalAmount,
          cutoffAt: prepared.cutoffAt,
          plannedDispatchReadyAt: prepared.plannedDispatchReadyAt,
          plannedKitchenReadyAt: prepared.plannedKitchenReadyAt,
          kitchenStartedAt: null,
          kitchenReadyAt: null,
          outForDeliveryAt: null,
          deliveredAt: null,
          employee: { connect: { id: prepared.employeeId } },
          company: { connect: { id: prepared.companyId } },
          lines: { create: prepared.lineCreates },
          statusHistory: { create: { status: prepared.status } },
        },
        select: ORDER_RESPONSE_SELECT,
      });

      if (prepared.status === OrderStatus.CONFIRMED) {
        await this.kitchenUnitProvisioning.ensureForConfirmedOrder(tx, created.id);
      }

      return toOrderResponse(created);
    });
  }

  async updatePending(id: number, dto: CreateOrderDto, actorRole: Role, now = new Date()) {
    if (actorRole !== Role.ADMIN) throw new ForbiddenException('Only an admin may edit orders');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: number }>>`SELECT "id" FROM "Order" WHERE "id" = ${id} FOR UPDATE`;
      const current = await tx.order.findUnique({
        where: { id },
        select: { id: true, status: true, invoiceId: true, deliveryDropId: true },
      });
      if (!current) throw new NotFoundException('Order was not found');
      if (current.status !== OrderStatus.DRAFT && current.status !== OrderStatus.PLACED) {
        throw new ConflictException('Only draft or placed orders can be edited');
      }
      if (current.invoiceId !== null || current.deliveryDropId !== null) {
        throw new ConflictException('An invoiced or dispatched order cannot be edited');
      }

      const prepared = await this.prepare(
        { ...dto, status: dto.status ?? current.status },
        now,
        tx,
      );
      const lines = await tx.orderLine.findMany({
        where: { orderId: id },
        select: { id: true },
      });
      const combinations = await tx.orderCombination.findMany({
        where: { orderLineId: { in: lines.map((line) => line.id) } },
        select: { id: true },
      });
      const combinationIds = combinations.map((combination) => combination.id);
      if (combinationIds.length) {
        await tx.kitchenUnit.deleteMany({ where: { orderCombinationId: { in: combinationIds } } });
        await tx.orderCombinationOption.deleteMany({ where: { combinationId: { in: combinationIds } } });
        await tx.orderCombination.deleteMany({ where: { id: { in: combinationIds } } });
      }
      if (lines.length) {
        await tx.orderLine.deleteMany({ where: { id: { in: lines.map((line) => line.id) } } });
      }
      const updated = await tx.order.update({
        where: { id },
        data: {
          status: prepared.status,
          deliveryDate: prepared.deliveryDate,
          deliveryTime: prepared.deliveryTime,
          deliveryAddressSnapshot: prepared.deliveryAddressSnapshot,
          packaging: prepared.packaging,
          driverInstructionsSnapshot: prepared.driverInstructionsSnapshot,
          totalAmount: prepared.totalAmount,
          cutoffAt: prepared.cutoffAt,
          plannedDispatchReadyAt: prepared.plannedDispatchReadyAt,
          plannedKitchenReadyAt: prepared.plannedKitchenReadyAt,
          employee: { connect: { id: prepared.employeeId } },
          company: { connect: { id: prepared.companyId } },
          lines: { create: prepared.lineCreates },
          ...(prepared.status !== current.status
            ? { statusHistory: { create: { status: prepared.status } } }
            : {}),
        },
        select: ORDER_RESPONSE_SELECT,
      });
      if (prepared.status === OrderStatus.CONFIRMED) {
        await this.kitchenUnitProvisioning.ensureForConfirmedOrder(tx, id);
      }
      return toOrderResponse(updated);
    });
  }

  async quote(dto: CreateOrderDto, actorRole: Role, now = new Date()) {
    if (actorRole !== Role.ADMIN) throw new ForbiddenException('Only an admin may create order quotes');
    const prepared = await this.prisma.$transaction((tx) => this.prepare(dto, now, tx));
    return {
      companyId: prepared.companyId,
      employeeId: prepared.employeeId,
      status: prepared.status,
      cutoffAt: prepared.cutoffAt.toISOString(),
      plannedKitchenReadyAt: prepared.plannedKitchenReadyAt.toISOString(),
      plannedDispatchReadyAt: prepared.plannedDispatchReadyAt.toISOString(),
      totalAmount: prepared.totalAmount.toFixed(2),
      lines: prepared.quoteLines,
    };
  }

  private async prepare(
    dto: CreateOrderDto,
    now: Date,
    tx: Prisma.TransactionClient,
  ): Promise<PreparedOrder> {
    assertCalendarDate(dto.deliveryDate);
    const deliveryDate = toDatabaseDate(dto.deliveryDate);
    const deliveryTime = toDatabaseTime(dto.deliveryTime);
    const employee = await tx.employee.findUnique({
      where: { id: dto.employeeId },
      include: {
        company: {
          include: {
            holidays: { where: { date: deliveryDate }, select: { date: true } },
            addresses: { orderBy: [{ isDefault: 'desc' }, { id: 'asc' }] },
            hiddenCategories: { select: { categoryId: true } },
            hiddenDishes: { select: { dishId: true } },
          },
        },
      },
    });
    if (!employee) throw new NotFoundException('Employee was not found');
    const company = employee.company;
    if (dto.companyId !== undefined && dto.companyId !== company.id) {
      throw new BadRequestException('companyId does not match the employee company');
    }
    if (!company.deliveryWorkingDays.includes(getWeekday(dto.deliveryDate))) {
      throw new BadRequestException('The company does not accept deliveries on the selected date');
    }
    if (company.holidays.length > 0) {
      throw new BadRequestException('The company is not accepting deliveries on the selected holiday');
    }
    if (!employee.canChangeDeliveryTime &&
        (!company.defaultDeliveryTime || formatDatabaseTime(company.defaultDeliveryTime) !== dto.deliveryTime)) {
      throw new BadRequestException('This employee is not allowed to change the company delivery time');
    }
    const addressSnapshot = this.resolveAddressSnapshot(dto, employee);
    const calendar = await tx.kitchenCalendarConfig.findUnique({
      where: { id: 1 },
      include: { holidays: { select: { date: true } } },
    });
    if (!calendar) throw new ServiceUnavailableException('Kitchen cutoff calendar has not been configured');
    const cutoffAt = this.cutoffCalculator.calculateCutoffAt({
      deliveryDate: dto.deliveryDate,
      cutoffWorkingDays: calendar.cutoffWorkingDays,
      cutoffTime: formatDatabaseTime(calendar.cutoffTime),
      workingDays: calendar.workingDays,
      holidays: calendar.holidays.map((holiday) => formatCalendarDate(holiday.date)),
    });
    const afterCutoff = now.getTime() >= cutoffAt.getTime();
    if (afterCutoff && dto.overrideCutoff !== true) {
      throw new ConflictException('The order cutoff has passed; an explicit admin override is required');
    }
    if (!afterCutoff && dto.overrideCutoff === true) {
      throw new BadRequestException('Cutoff override is only valid after the calculated cutoff');
    }
    const packaging = this.resolvePackaging(dto, employee.canChangePackaging, company.defaultPackaging);
    const priceTierId = await this.resolvePriceTierId(tx, company.priceTierId);
    const hiddenCategoryIds = company.hiddenCategories.map((item) => item.categoryId);
    const hiddenDishIds = company.hiddenDishes.map((item) => item.dishId);
    const requestedDishIds = [...new Set(dto.lines.map((line) => line.dishId))];
    const dishes = await tx.dish.findMany({
      where: { id: { in: requestedDishIds } },
      include: {
        category: { select: { active: true, secret: true } },
        optionGroups: {
          include: {
            optionGroup: {
              include: {
                options: {
                  where: { option: { active: true } },
                  include: {
                    option: { select: { id: true, name: true, active: true } },
                    portions: { include: { portionSize: { select: { name: true, active: true } } } },
                  },
                },
              },
            },
          },
        },
      },
    });
    const dishesById = new Map(dishes.map((dish) => [dish.id, dish]));
    let totalAmount = new Prisma.Decimal(0);
    const lineCreates: Prisma.OrderLineCreateWithoutOrderInput[] = [];
    const quoteLines: PreparedOrder['quoteLines'] = [];
    for (const line of dto.lines) {
      const dish = dishesById.get(line.dishId);
      if (!dish) throw new NotFoundException(`Dish ${line.dishId} was not found`);
      if (!dish.active || !dish.category.active ||
          hiddenCategoryIds.includes(dish.categoryId) || hiddenDishIds.includes(dish.id)) {
        throw new BadRequestException(`Dish ${dish.name} is not available to this company`);
      }
      if (line.quantity < dish.minimumOrderQuantity) {
        throw new BadRequestException(`${dish.name} minimum order quantity is ${dish.minimumOrderQuantity}`);
      }
      const dishUnitPrice = await this.pricingService.effectiveDishPrice(tx, dish.id, dish.costPrice, priceTierId);
      if (dishUnitPrice === null) throw new BadRequestException(`No effective price is configured for ${dish.name}`);
      const groups = dish.optionGroups as GroupLink[];
      const combinations: ValidatedCombination[] = [];
      let combinationQuantityTotal = 0;
      for (const combination of line.combinations) {
        combinationQuantityTotal += combination.quantity;
        combinations.push(await this.validateCombination(tx, groups, combination, priceTierId, dishUnitPrice));
      }
      if (combinationQuantityTotal !== line.quantity) {
        throw new BadRequestException(`Combination quantities for ${dish.name} must sum to the line quantity`);
      }
      const lineTotal = combinations.reduce((sum, combination) => sum.plus(combination.totalPrice), new Prisma.Decimal(0));
      totalAmount = totalAmount.plus(lineTotal);
      lineCreates.push({
        quantity: line.quantity,
        dishNameSnapshot: dish.name,
        dishSkuSnapshot: dish.sku,
        dishUnitPriceSnapshot: dishUnitPrice,
        lineTotal,
        dish: { connect: { id: dish.id } },
        combinations: {
          create: combinations.map((combination) => ({
            quantity: combination.quantity,
            unitPrice: combination.unitPrice,
            totalPrice: combination.totalPrice,
            options: {
              create: combination.options.map((option) => ({
                optionId: option.id,
                optionGroupIdSnapshot: option.optionGroupId,
                portionSizeIdSnapshot: option.portionId,
                optionNameSnapshot: option.name,
                optionPriceSnapshot: option.price,
                portionNameSnapshot: option.portionName,
                portionExtraPriceSnapshot: option.portionExtraPrice,
              })),
            },
          })),
        },
      });
      quoteLines.push({
        dishId: dish.id,
        dishName: dish.name,
        quantity: line.quantity,
        dishUnitPrice: dishUnitPrice.toFixed(2),
        lineTotal: lineTotal.toFixed(2),
        combinations: combinations.map((combination) => ({
          quantity: combination.quantity,
          unitPrice: combination.unitPrice.toFixed(2),
          totalPrice: combination.totalPrice.toFixed(2),
          options: combination.options.map((option) => ({
            id: option.id, name: option.name, unitPrice: option.price.toFixed(2),
            portionName: option.portionName,
          })),
        })),
      });
    }
    const planning = this.planningService.calculate({
      deliveryDate: dto.deliveryDate,
      deliveryTime: dto.deliveryTime,
      deliveryMinutes: company.deliveryMinutes,
    });
    return {
      employeeId: employee.id,
      companyId: company.id,
      status: afterCutoff ? OrderStatus.CONFIRMED : (dto.status ?? OrderStatus.DRAFT),
      deliveryDate,
      deliveryTime,
      deliveryAddressSnapshot: addressSnapshot,
      packaging,
      driverInstructionsSnapshot: company.driverInstructions,
      totalAmount,
      cutoffAt,
      plannedDispatchReadyAt: planning.plannedDispatchReadyAt,
      plannedKitchenReadyAt: planning.plannedKitchenReadyAt,
      lineCreates,
      quoteLines,
    };
  }

  private resolveAddressSnapshot(
    dto: CreateOrderDto,
    employee: Prisma.EmployeeGetPayload<{ include: { company: { include: { addresses: true } } } }>,
  ): Prisma.InputJsonValue {
    if (dto.deliveryAddressId !== undefined && dto.deliveryAddressSnapshot) {
      throw new BadRequestException('Provide either deliveryAddressId or an address snapshot, not both');
    }
    const defaultAddress = employee.company.addresses.find((address) => address.isDefault) ??
      employee.company.addresses[0];
    const selectedAddress = dto.deliveryAddressId !== undefined
      ? employee.company.addresses.find((address) => address.id === dto.deliveryAddressId)
      : undefined;
    if (dto.deliveryAddressId !== undefined && !selectedAddress) {
      throw new BadRequestException('Delivery address does not belong to the employee company');
    }
    if (!employee.canChooseDeliveryAddress) {
      if (!defaultAddress && dto.deliveryAddressSnapshot) {
        throw new BadRequestException('This employee is not allowed to choose a delivery address');
      }
      if (selectedAddress && selectedAddress.id !== defaultAddress?.id) {
        throw new BadRequestException('This employee is not allowed to change the delivery address');
      }
      if (dto.deliveryAddressSnapshot && defaultAddress &&
          !sameAddress(dto.deliveryAddressSnapshot, defaultAddress)) {
        throw new BadRequestException('This employee is not allowed to change the delivery address');
      }
    }

    function sameAddress(
      snapshot: {
        recipientName: string;
        addressLine1: string;
        addressLine2?: string;
        city: string;
        region: string;
        postalCode: string;
        country: string;
      },
      address: {
        recipientName: string;
        addressLine1: string;
        addressLine2: string | null;
        city: string;
        region: string;
        postalCode: string;
        country: string;
      },
    ) {
      return [
        snapshot.recipientName, snapshot.addressLine1, snapshot.addressLine2 ?? '',
        snapshot.city, snapshot.region, snapshot.postalCode, snapshot.country,
      ].map((value) => value.trim().toLowerCase()).join('|') === [
        address.recipientName, address.addressLine1, address.addressLine2 ?? '',
        address.city, address.region, address.postalCode, address.country,
      ].map((value) => value.trim().toLowerCase()).join('|');
    }
    const address = selectedAddress ?? dto.deliveryAddressSnapshot ?? defaultAddress;
    if (!address) throw new BadRequestException('A company delivery address must be configured');
    const snapshot = {
      recipientName: address.recipientName,
      addressLine1: address.addressLine1,
      ...(address.addressLine2 ? { addressLine2: address.addressLine2 } : {}),
      city: address.city,
      region: address.region,
      postalCode: address.postalCode,
      country: address.country,
    };
    return JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue;
  }

  private resolvePackaging(
    dto: CreateOrderDto,
    canChangePackaging: boolean,
    defaultPackaging: string | null,
  ): string {
    const packaging = dto.packaging ?? defaultPackaging;
    if (!packaging) {
      throw new BadRequestException('Packaging must be provided by the company or order');
    }
    if (
      dto.packaging !== undefined &&
      !canChangePackaging &&
      dto.packaging !== defaultPackaging
    ) {
      throw new BadRequestException(
        'This employee is not allowed to change the company packaging',
      );
    }
    return packaging;
  }

  private async resolvePriceTierId(
    tx: Prisma.TransactionClient,
    companyPriceTierId: number | null,
  ): Promise<number> {
    if (companyPriceTierId !== null) {
      const assignedTier = await tx.priceTier.findUnique({
        where: { id: companyPriceTierId },
        select: { id: true },
      });
      if (!assignedTier) {
        throw new BadRequestException('The company price tier does not exist');
      }
      return assignedTier.id;
    }

    const defaultTier = await tx.priceTier.findFirst({
      where: { isDefault: true },
      orderBy: { id: 'asc' },
      select: { id: true },
    });
    if (!defaultTier) {
      throw new ServiceUnavailableException('A default price tier is not configured');
    }
    return defaultTier.id;
  }

  private async validateCombination(
    tx: Prisma.TransactionClient,
    groupLinks: GroupLink[],
    combination: OrderCombinationDto,
    priceTierId: number,
    dishUnitPrice: Prisma.Decimal,
  ): Promise<ValidatedCombination> {
    if (!Number.isInteger(combination.quantity) || combination.quantity < 1) {
      throw new BadRequestException('Combination quantity must be a positive integer');
    }

    const groupsById = new Map(
      groupLinks.map((link) => [link.optionGroup.id, link.optionGroup]),
    );
    const selectedByGroup = new Map<number, number[]>();
    const portionsByGroup = new Map<number, Map<number, number>>();
    for (const selection of combination.selections) {
      if (selectedByGroup.has(selection.optionGroupId)) {
        throw new BadRequestException('An option group cannot be selected more than once');
      }
      if (!groupsById.has(selection.optionGroupId)) {
        throw new BadRequestException('Selected option group is not assigned to this dish');
      }
      if (new Set(selection.optionIds).size !== selection.optionIds.length) {
        throw new BadRequestException('An option cannot be selected more than once in a group');
      }
      selectedByGroup.set(selection.optionGroupId, selection.optionIds);
      const portionMap = new Map<number, number>();
      for (const portion of selection.portions ?? []) {
        if (portionMap.has(portion.optionId)) {
          throw new BadRequestException('An option can only have one selected portion');
        }
        portionMap.set(portion.optionId, portion.portionId);
      }
      portionsByGroup.set(selection.optionGroupId, portionMap);
    }

    const selectedOptions: ValidatedOption[] = [];
    for (const [groupId, group] of groupsById) {
      const optionIds = selectedByGroup.get(groupId) ?? [];
      const minimum = group.required ? Math.max(1, group.minSelections) : group.minSelections;
      if (optionIds.length < minimum) {
        throw new BadRequestException(`Option group ${group.id} requires more selections`);
      }
      if (group.maxSelections !== null && optionIds.length > group.maxSelections) {
        throw new BadRequestException(`Option group ${group.id} allows fewer selections`);
      }

      const allowedOptions = new Map(
        group.options.map((link) => [link.optionId, link.option]),
      );
      const allowedLinks = new Map(group.options.map((link) => [link.optionId, link]));
      const portionSelections = portionsByGroup.get(groupId) ?? new Map<number, number>();
      for (const selectedOptionId of portionSelections.keys()) {
        if (!optionIds.includes(selectedOptionId)) {
          throw new BadRequestException('A portion was selected for an option that is not selected');
        }
      }
      if (!group.usesPortions && portionSelections.size > 0) {
        throw new BadRequestException('This option group does not support portions');
      }
      for (const optionId of optionIds) {
        const option = allowedOptions.get(optionId);
        if (!option) {
          throw new BadRequestException(
            `Option ${optionId} is not available in option group ${group.id}`,
          );
        }
        if (!option.active) {
          throw new BadRequestException(`Option ${option.name} is not active`);
        }

        const price = await this.pricingService.effectiveOptionPrice(
          tx,
          option.id,
          priceTierId,
        );
        if (price === null) {
          throw new BadRequestException(`No effective price is configured for ${option.name}`);
        }
        const optionLink = allowedLinks.get(optionId);
        let portionName: string | null = null;
        let selectedPortionId: number | null = null;
        let portionExtraPrice = new Prisma.Decimal(0);
        if (group.usesPortions) {
          const portionId = portionSelections.get(optionId);
          if (portionId === undefined) {
            throw new BadRequestException(`A portion must be selected for ${option.name}`);
          }
          const portion = optionLink?.portions.find((item) => item.id === portionId);
          if (!portion) throw new BadRequestException('Selected portion is not available for this option');
          if (!portion.portionSize.active) {
            throw new BadRequestException('Selected portion size is inactive');
          }
          portionName = portion.portionSize.name;
          selectedPortionId = portion.portionSizeId;
          portionExtraPrice = portion.extraPrice;
        }
        selectedOptions.push({
          id: option.id,
          optionGroupId: groupId,
          portionId: selectedPortionId,
          name: option.name,
          price: this.pricingService.roundUpToFiveCents(price.plus(portionExtraPrice)),
          portionName,
          portionExtraPrice,
        });
      }
    }

    const unitPrice = this.pricingService.roundUpToFiveCents(
      selectedOptions.reduce(
        (sum, option) => sum.plus(option.price),
        dishUnitPrice,
      ),
    );
    return {
      quantity: combination.quantity,
      unitPrice,
      totalPrice: unitPrice.mul(combination.quantity),
      options: selectedOptions,
    };
  }
}