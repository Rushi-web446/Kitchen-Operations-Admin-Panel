import {
  ForbiddenException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  OrderStatus,
  Prisma,
  PricingRuleType,
  Role,
  Weekday,
} from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../database/prisma.service';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateOrderDto } from './dto/create-order.dto';
import { CutoffCalculatorService } from './cutoff-calculator.service';
import { OrderCreationService } from './order-creation.service';
import { OrderPlanningService } from './order-planning.service';
import { OrderPricingService } from './order-pricing.service';
import { OrderResponseRecord } from './order-response';

const workingDays = [
  Weekday.MONDAY,
  Weekday.TUESDAY,
  Weekday.WEDNESDAY,
  Weekday.THURSDAY,
  Weekday.FRIDAY,
];

const responseFixture = {
  id: 41,
  status: OrderStatus.DRAFT,
  deliveryDate: new Date('2026-10-07T00:00:00.000Z'),
  deliveryTime: new Date('1970-01-01T12:00:00.000Z'),
  deliveryAddressSnapshot: {
    recipientName: 'Alex Morgan',
    addressLine1: '1 Test Street',
    city: 'Pune',
    region: 'Maharashtra',
    postalCode: '411001',
    country: 'IN',
  },
  packaging: 'Tray',
  totalAmount: new Prisma.Decimal('22.50'),
  cutoffAt: new Date('2026-10-05T10:30:00.000Z'),
  plannedDispatchReadyAt: new Date('2026-10-07T05:30:00.000Z'),
  plannedKitchenReadyAt: new Date('2026-10-07T05:00:00.000Z'),
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
  invoice: null,
  statusHistory: [],
  employee: { id: 5, name: 'Alex Morgan', email: 'alex@example.test' },
  company: { id: 3, name: 'Test Company' },
  lines: [
    {
      id: 52,
      dishId: 7,
      quantity: 2,
      dishNameSnapshot: 'Paneer Bowl',
      dishSkuSnapshot: 'DISH-7',
      dishUnitPriceSnapshot: new Prisma.Decimal('10.00'),
      lineTotal: new Prisma.Decimal('22.50'),
      combinations: [
        {
          id: 61,
          quantity: 2,
          unitPrice: new Prisma.Decimal('11.25'),
          totalPrice: new Prisma.Decimal('22.50'),
          options: [
            {
              id: 70,
              optionId: 60,
              optionNameSnapshot: 'Jeera Rice',
              optionPriceSnapshot: new Prisma.Decimal('1.25'),
              portionNameSnapshot: null,
              portionExtraPriceSnapshot: new Prisma.Decimal('0.00'),
            },
          ],
        },
      ],
    },
  ],
} as unknown as OrderResponseRecord;

function dto(overrides: Partial<CreateOrderDto> = {}): CreateOrderDto {
  return {
    employeeId: 5,
    deliveryDate: '2026-10-07',
    deliveryTime: '12:00',
    status: OrderStatus.DRAFT,
    deliveryAddressSnapshot: {
      recipientName: 'Alex Morgan',
      addressLine1: '1 Test Street',
      city: 'Pune',
      region: 'Maharashtra',
      postalCode: '411001',
      country: 'IN',
    },
    lines: [
      {
        dishId: 7,
        quantity: 2,
        combinations: [
          {
            quantity: 2,
            selections: [{ optionGroupId: 50, optionIds: [60] }],
          },
        ],
      },
    ],
    ...overrides,
  };
}

function makeService(options: {
  employee?: object | null;
  holidays?: Array<{ date: Date }>;
  deliveryWorkingDays?: Weekday[];
  dishes?: object[];
  dishOverride?: Prisma.Decimal | null;
  optionOverride?: Prisma.Decimal | null;
  pricingRuleType?: PricingRuleType;
  createError?: Error;
  canChangeDeliveryTime?: boolean;
} = {}) {
  const employee =
    options.employee === undefined
      ? {
          id: 5,
          companyId: 3,
          canChooseDeliveryAddress: false,
          canChangeDeliveryTime: options.canChangeDeliveryTime ?? false,
          canChangePackaging: false,
          company: {
            id: 3,
            name: 'Test Company',
            priceTierId: 1,
            deliveryMinutes: 60,
            defaultDeliveryTime: new Date('1970-01-01T12:00:00.000Z'),
            addresses: [{
              id: 8,
              label: 'Main office',
              recipientName: 'Alex Morgan',
              addressLine1: '1 Test Street',
              addressLine2: null,
              city: 'Pune',
              region: 'Maharashtra',
              postalCode: '411001',
              country: 'IN',
              isDefault: true,
            }],
            hiddenCategories: [],
            hiddenDishes: [],
            deliveryWorkingDays: options.deliveryWorkingDays ?? workingDays,
            defaultPackaging: 'Tray',
            driverInstructions: null,
            holidays: options.holidays ?? [],
          },
        }
      : options.employee;

  const dish = {
    id: 7,
    name: 'Paneer Bowl',
    sku: 'DISH-7',
    minimumOrderQuantity: 1,
    active: true,
    costPrice: new Prisma.Decimal('5.00'),
    category: { active: true },
    optionGroups: [
      {
        optionGroup: {
          id: 50,
          required: true,
          minSelections: 1,
          maxSelections: 1,
          usesPortions: false,
          options: [{ optionId: 60, option: { id: 60, name: 'Jeera Rice', active: true }, portions: [] }],
        },
      },
    ],
  };

  const tx = {
    employee: { findUnique: vi.fn(async () => employee) },
    kitchenCalendarConfig: {
      findUnique: vi.fn(async () => ({
        id: 1,
        cutoffWorkingDays: 2,
        cutoffTime: new Date('1970-01-01T16:00:00.000Z'),
        workingDays,
        holidays: [],
      })),
    },
    priceTier: {
      findUnique: vi.fn(async () => ({ id: 1 })),
      findFirst: vi.fn(async () => ({ id: 1 })),
    },
    dish: {
      findMany: vi.fn(async () => (options.dishes ?? [dish]) as never[]),
    },
    dishPrice: {
      findUnique: vi.fn(async () =>
        options.dishOverride === undefined
          ? null
          : { overridePrice: options.dishOverride },
      ),
    },
    optionPrice: {
      findUnique: vi.fn(async () =>
        options.optionOverride === undefined
          ? { overridePrice: new Prisma.Decimal('1.21') }
          : { overridePrice: options.optionOverride },
      ),
    },
    order: {
      create: vi.fn(async () => {
        if (options.createError) throw options.createError;
        return responseFixture;
      }),
    },
  };

  tx.priceTier.findUnique.mockImplementation(async () => ({
    id: 1,
    pricingRuleType: options.pricingRuleType ?? PricingRuleType.COST_MULTIPLIER,
    baseTierId: null,
    multiplier: new Prisma.Decimal('2'),
    markupPercent: null,
  }) as never);

  const transaction = vi.fn(
    async (callback: (client: Prisma.TransactionClient) => Promise<unknown>) =>
      callback(tx as unknown as Prisma.TransactionClient),
  );
  const prisma = { $transaction: transaction } as unknown as PrismaService;
  const kitchenUnitProvisioning = {
    ensureForConfirmedOrder: vi.fn(async () => 1),
  };
  const service = new OrderCreationService(
    prisma,
    new CutoffCalculatorService(),
    new OrderPlanningService(),
    new OrderPricingService(),
    kitchenUnitProvisioning as never,
  );

  return { service, tx, transaction, kitchenUnitProvisioning };
}

describe('OrderCreationService', () => {
  const beforeCutoff = new Date('2026-10-01T00:00:00.000Z');

  it.each([OrderStatus.DRAFT, OrderStatus.PLACED])(
    'creates a %s order with server-calculated snapshots',
    async (status) => {
      const { service, tx } = makeService();
      await service.create(dto({ status }), Role.ADMIN, beforeCutoff);

      const data = tx.order.create.mock.calls[0][0].data;
      expect(data.status).toBe(status);
      expect(data.totalAmount?.toString()).toBe('22.5');
      expect(data.cutoffAt?.toISOString()).toBe('2026-10-05T10:30:00.000Z');
      expect(data.plannedDispatchReadyAt?.toISOString()).toBe(
        '2026-10-07T05:30:00.000Z',
      );
      expect(data.plannedKitchenReadyAt?.toISOString()).toBe(
        '2026-10-07T05:00:00.000Z',
      );
      expect(data.kitchenStartedAt).toBeNull();
      expect(data.kitchenReadyAt).toBeNull();
      expect(data.lines?.create).toHaveLength(1);
    },
  );

  it('prices split combinations and verifies their quantities reconcile to the dish line', async () => {
    const { service, tx } = makeService();
    await service.create(dto({
      lines: [{
        dishId: 7,
        quantity: 3,
        combinations: [
          { quantity: 1, selections: [{ optionGroupId: 50, optionIds: [60] }] },
          { quantity: 2, selections: [{ optionGroupId: 50, optionIds: [60] }] },
        ],
      }],
    }), Role.ADMIN, beforeCutoff);

    const line = tx.order.create.mock.calls[0][0].data.lines?.create[0];
    expect(line.quantity).toBe(3);
    expect(line.lineTotal?.toString()).toBe('33.75');
    expect(line.combinations?.create).toHaveLength(2);
    expect(line.combinations?.create.reduce((sum, item) => sum + item.quantity, 0)).toBe(3);
  });

  it('enforces delivery-time permissions and quotes permitted changes without writing', async () => {
    const restricted = makeService();
    await expect(
      restricted.service.quote(dto({ deliveryTime: '13:00' }), Role.ADMIN, beforeCutoff),
    ).rejects.toBeInstanceOf(BadRequestException);

    const permitted = makeService({ canChangeDeliveryTime: true });
    const quote = await permitted.service.quote(
      dto({ deliveryTime: '13:00' }),
      Role.ADMIN,
      beforeCutoff,
    );
    expect(quote.totalAmount).toBe('22.50');
    expect(permitted.tx.order.create).not.toHaveBeenCalled();
  });

  it('rejects a custom address for employees without address permission', async () => {
    const { service } = makeService();
    await expect(
      service.quote(
        dto({
          deliveryAddressSnapshot: {
            recipientName: 'Alex Morgan',
            addressLine1: '99 Other Street',
            city: 'Pune',
            region: 'Maharashtra',
            postalCode: '411001',
            country: 'IN',
          },
        }),
        Role.ADMIN,
        beforeCutoff,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a confirmed order only with an explicit admin post-cutoff override', async () => {
    const { service, tx, kitchenUnitProvisioning } = makeService();
    await service.create(
      dto({ overrideCutoff: true }),
      Role.ADMIN,
      new Date('2026-10-05T10:31:00.000Z'),
    );
    expect(tx.order.create.mock.calls[0][0].data.status).toBe(OrderStatus.CONFIRMED);
    expect(kitchenUnitProvisioning.ensureForConfirmedOrder).toHaveBeenCalledOnce();
  });

  it('rejects a late order without the explicit override', async () => {
    const { service, tx } = makeService();
    await expect(
      service.create(dto(), Role.ADMIN, new Date('2026-10-05T10:31:00.000Z')),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('rejects non-admin creation before opening a transaction', async () => {
    const { service, transaction } = makeService();
    await expect(service.create(dto(), Role.KITCHEN, beforeCutoff)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it('requires an employee and validates any supplied company id', async () => {
    const missing = makeService({ employee: null });
    await expect(missing.service.create(dto(), Role.ADMIN, beforeCutoff)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    const mismatched = makeService();
    await expect(
      mismatched.service.create(dto({ companyId: 999 }), Role.ADMIN, beforeCutoff),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid calendar dates, missing dishes, and missing applicable prices', async () => {
    const invalidDate = makeService();
    await expect(
      invalidDate.service.create(dto({ deliveryDate: '2026-02-30' }), Role.ADMIN, beforeCutoff),
    ).rejects.toBeInstanceOf(BadRequestException);

    const missingDish = makeService({ dishes: [] });
    await expect(missingDish.service.create(dto(), Role.ADMIN, beforeCutoff)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    const missingPrice = makeService({ pricingRuleType: PricingRuleType.MANUAL });
    await expect(
      missingPrice.service.create(dto(), Role.ADMIN, beforeCutoff),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects client-provided totals instead of trusting frontend calculations', async () => {
    const request = plainToInstance(CreateOrderDto, {
      ...dto(),
      totalAmount: 0,
    });
    const errors = await validate(request, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors.some((error) => error.property === 'totalAmount')).toBe(true);
  });

  it('rejects company non-working days and company holidays independently of kitchen cutoff', async () => {
    const nonWorking = makeService({ deliveryWorkingDays: [Weekday.MONDAY] });
    await expect(
      nonWorking.service.create(dto(), Role.ADMIN, beforeCutoff),
    ).rejects.toBeInstanceOf(BadRequestException);

    const holiday = makeService({ holidays: [{ date: new Date('2026-10-07T00:00:00.000Z') }] });
    await expect(holiday.service.create(dto(), Role.ADMIN, beforeCutoff)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects missing required selections, invalid options, and mismatched combination quantities', async () => {
    const missingRequired = makeService();
    await expect(
      missingRequired.service.create(
        dto({ lines: [{ dishId: 7, quantity: 2, combinations: [{ quantity: 2, selections: [] }] }] }),
        Role.ADMIN,
        beforeCutoff,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    const invalidOption = makeService();
    await expect(
      invalidOption.service.create(
        dto({
          lines: [{
            dishId: 7,
            quantity: 2,
            combinations: [{ quantity: 2, selections: [{ optionGroupId: 50, optionIds: [999] }] }],
          }],
        }),
        Role.ADMIN,
        beforeCutoff,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    const mismatch = makeService();
    await expect(
      mismatch.service.create(
        dto({
          lines: [{
            dishId: 7,
            quantity: 2,
            combinations: [{ quantity: 1, selections: [{ optionGroupId: 50, optionIds: [60] }] }],
          }],
        }),
        Role.ADMIN,
        beforeCutoff,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rolls back the order transaction when nested child creation fails', async () => {
    const { service, transaction } = makeService({ createError: new Error('child write failed') });
    await expect(service.create(dto(), Role.ADMIN, beforeCutoff)).rejects.toThrow(
      'child write failed',
    );
    expect(transaction).toHaveBeenCalledOnce();
  });
});