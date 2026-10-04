import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { getWeekday, toDatabaseDate } from '../orders/calendar-time';
import {
  CategoryDto, DishDto, ListCatalogueDto, MenuPreviewQueryDto, OptionDto,
  OptionGroupDto, ReferenceNameDto,
} from './dto/catalogue.dto';

const DISH_INCLUDE = {
  category: { select: { id: true, name: true } },
  allergens: { include: { allergen: { select: { id: true, name: true } } } },
  dietaryTags: { include: { dietaryTag: { select: { id: true, name: true } } } },
  optionGroups: {
    orderBy: { displayOrder: 'asc' as const },
    include: {
      optionGroup: {
        include: {
          options: {
            orderBy: { displayOrder: 'asc' as const },
            include: {
              option: { select: { id: true, name: true, active: true } },
              portions: { include: { portionSize: { select: { name: true, active: true } } } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.DishInclude;

@Injectable()
export class CatalogueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
  ) {}

  async listCategories() {
    return this.prisma.category.findMany({
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
      include: {
        _count: { select: { dishes: true } },
        hiddenFor: { select: { companyId: true } },
      },
    });
  }

  async createCategory(dto: CategoryDto) {
    return this.prisma.category.create({
      data: {
        name: dto.name.trim(),
        description: dto.description,
        displayOrder: dto.displayOrder ?? 0,
        active: dto.active ?? true,
        secret: dto.secret ?? false,
      },
    });
  }

  async updateCategory(id: number, dto: CategoryDto) {
    await this.requireCategory(id);
    return this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name.trim(),
        description: dto.description,
        displayOrder: dto.displayOrder ?? 0,
        active: dto.active ?? true,
        secret: dto.secret ?? false,
      },
    });
  }

  async listDishes(query: ListCatalogueDto) {
    const where: Prisma.DishWhereInput = {
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.search ? {
        OR: [
          { name: { contains: query.search.trim(), mode: 'insensitive' } },
          { sku: { contains: query.search.trim(), mode: 'insensitive' } },
        ],
      } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.dish.findMany({
        where, include: DISH_INCLUDE,
        orderBy: [{ category: { displayOrder: 'asc' } }, { displayOrder: 'asc' }, { id: 'asc' }],
        take: query.limit, skip: query.offset,
      }),
      this.prisma.dish.count({ where }),
    ]);
    return { data: data.map(formatDish), meta: { total, limit: query.limit, offset: query.offset } };
  }

  async getDish(id: number) {
    const dish = await this.prisma.dish.findUnique({ where: { id }, include: DISH_INCLUDE });
    if (!dish) throw new NotFoundException('Dish was not found');
    return formatDish(dish);
  }

  async createDish(dto: DishDto) {
    await this.validateDish(dto);
    const dish = await this.prisma.$transaction(async (tx) => {
      const record = await tx.dish.create({
        data: this.dishData(dto),
        include: DISH_INCLUDE,
      });
      await this.replaceDishRelations(tx, record.id, dto);
      return tx.dish.findUniqueOrThrow({ where: { id: record.id }, include: DISH_INCLUDE });
    }).catch((error: unknown) => this.rethrow(error, 'SKU already exists'));
    return formatDish(dish);
  }

  async updateDish(id: number, dto: DishDto) {
    await this.getDish(id);
    await this.validateDish(dto);
    const dish = await this.prisma.$transaction(async (tx) => {
      await tx.dish.update({ where: { id }, data: this.dishData(dto) });
      await this.replaceDishRelations(tx, id, dto);
      return tx.dish.findUniqueOrThrow({ where: { id }, include: DISH_INCLUDE });
    }).catch((error: unknown) => this.rethrow(error, 'SKU already exists'));
    return formatDish(dish);
  }

  async listOptions() {
    const options = await this.prisma.option.findMany({
      orderBy: { name: 'asc' },
      include: {
        allergens: { include: { allergen: { select: { id: true, name: true } } } },
        dietaryTags: { include: { dietaryTag: { select: { id: true, name: true } } } },
      },
    });
    return options.map((option) => ({
      ...option,
      costPrice: option.costPrice.toFixed(2),
      allergens: option.allergens.map(({ allergen }) => allergen),
      dietaryTags: option.dietaryTags.map(({ dietaryTag }) => dietaryTag),
    }));
  }

  async createOption(dto: OptionDto) {
    await this.validateReferenceIds(dto.allergenIds ?? [], dto.dietaryTagIds ?? []);
    return this.prisma.$transaction(async (tx) => {
      const option = await tx.option.create({
        data: { name: dto.name.trim(), costPrice: new Prisma.Decimal(dto.costPrice), active: dto.active ?? true },
      });
      await this.replaceOptionRelations(tx, option.id, dto);
      return option;
    }).catch((error: unknown) => this.rethrow(error, 'Option could not be created'));
  }

  async updateOption(id: number, dto: OptionDto) {
    const exists = await this.prisma.option.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Option was not found');
    await this.validateReferenceIds(dto.allergenIds ?? [], dto.dietaryTagIds ?? []);
    const option = await this.prisma.$transaction(async (tx) => {
      await tx.option.update({
        where: { id },
        data: { name: dto.name.trim(), costPrice: new Prisma.Decimal(dto.costPrice), active: dto.active ?? true },
      });
      await this.replaceOptionRelations(tx, id, dto);
      return tx.option.findUniqueOrThrow({ where: { id } });
    }).catch((error: unknown) => this.rethrow(error, 'Option could not be updated'));
    return { ...option, costPrice: option.costPrice.toFixed(2) };
  }

  async listOptionGroups() {
    const groups = await this.prisma.optionGroup.findMany({
      orderBy: { name: 'asc' },
      include: {
        options: { orderBy: { displayOrder: 'asc' }, include: { option: true, portions: { include: { portionSize: true } } } },
        dishes: { orderBy: { displayOrder: 'asc' }, include: { dish: { select: { id: true, name: true } } } },
      },
    });
    return groups.map(formatOptionGroup);
  }

  async createOptionGroup(dto: OptionGroupDto) {
    await this.validateGroup(dto);
    const group = await this.prisma.$transaction(async (tx) => {
      const record = await tx.optionGroup.create({
        data: {
          name: dto.name.trim(), required: dto.required ?? false,
          usesPortions: dto.usesPortions ?? false,
          minSelections: dto.minSelections ?? (dto.required ? 1 : 0),
          maxSelections: dto.maxSelections,
        },
      });
      await this.replaceGroupRelations(tx, record.id, dto);
      return tx.optionGroup.findUniqueOrThrow({
        where: { id: record.id },
        include: {
          options: { orderBy: { displayOrder: 'asc' }, include: { option: true, portions: { include: { portionSize: true } } } },
          dishes: { orderBy: { displayOrder: 'asc' }, include: { dish: { select: { id: true, name: true } } } },
        },
      });
    });
    return formatOptionGroup(group);
  }

  async updateOptionGroup(id: number, dto: OptionGroupDto) {
    const exists = await this.prisma.optionGroup.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Option group was not found');
    await this.validateGroup(dto);
    const group = await this.prisma.$transaction(async (tx) => {
      await tx.optionGroup.update({
        where: { id },
        data: {
          name: dto.name.trim(), required: dto.required ?? false,
          usesPortions: dto.usesPortions ?? false,
          minSelections: dto.minSelections ?? (dto.required ? 1 : 0),
          maxSelections: dto.maxSelections,
        },
      });
      await this.replaceGroupRelations(tx, id, dto);
      return tx.optionGroup.findUniqueOrThrow({
        where: { id },
        include: {
          options: { orderBy: { displayOrder: 'asc' }, include: { option: true, portions: { include: { portionSize: true } } } },
          dishes: { orderBy: { displayOrder: 'asc' }, include: { dish: { select: { id: true, name: true } } } },
        },
      });
    });
    return formatOptionGroup(group);
  }

  async referenceData() {
    const [allergens, dietaryTags, categories, kitchenStations] = await this.prisma.$transaction([
      this.prisma.allergen.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.dietaryTag.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.category.findMany({ orderBy: { displayOrder: 'asc' }, select: { id: true, name: true } }),
      this.prisma.kitchenStationReference.findMany({
        where: { active: true },
        orderBy: { name: 'asc' },
        select: { name: true },
      }),
    ]);
    return { allergens, dietaryTags, categories, kitchenStations: kitchenStations.map(({ name }) => name) };
  }

  async createReference(kind: 'allergens' | 'dietary-tags', dto: ReferenceNameDto) {
    try {
      return kind === 'allergens'
        ? await this.prisma.allergen.create({ data: { name: dto.name.trim() } })
        : await this.prisma.dietaryTag.create({ data: { name: dto.name.trim() } });
    } catch (error) {
      this.rethrow(error, 'Reference data already exists');
    }
  }

  async previewMenu(query: MenuPreviewQueryDto) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: query.employeeId },
      include: {
        company: {
          include: {
            holidays: query.deliveryDate
              ? { where: { date: toDatabaseDate(query.deliveryDate) }, select: { date: true } }
              : { select: { date: true } },
            addresses: { orderBy: [{ isDefault: 'desc' }, { id: 'asc' }] },
            hiddenCategories: { select: { categoryId: true } },
            hiddenDishes: { select: { dishId: true } },
          },
        },
        allergens: { include: { allergen: { select: { id: true, name: true } } } },
        dietaryPreferences: { include: { dietaryTag: { select: { id: true, name: true } } } },
      },
    });
    if (!employee) throw new NotFoundException('Employee was not found');
    if (employee.companyId !== query.companyId) throw new BadRequestException('Employee does not belong to the selected company');
    const priceTierId = await this.pricing.resolveCompanyPriceTier(query.companyId);
    const excludedCategories = employee.company.hiddenCategories.map((item) => item.categoryId);
    const excludedDishes = employee.company.hiddenDishes.map((item) => item.dishId);
    const categories = await this.prisma.category.findMany({
      where: {
        active: true,
        ...(query.includeSecretCategories ? {} : { secret: false }),
        id: { notIn: excludedCategories },
        dishes: {
          some: {
            active: true,
            id: { notIn: excludedDishes },
          },
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
      include: {
        dishes: {
          where: { active: true, id: { notIn: excludedDishes } },
          orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
          include: {
            allergens: { include: { allergen: { select: { id: true, name: true } } } },
            dietaryTags: { include: { dietaryTag: { select: { id: true, name: true } } } },
            optionGroups: {
              orderBy: { displayOrder: 'asc' },
              include: {
                optionGroup: {
                  include: {
                    options: {
                      orderBy: { displayOrder: 'asc' },
                      where: { option: { active: true } },
                      include: {
                        option: {
                          include: {
                            allergens: { include: { allergen: { select: { id: true, name: true } } } },
                            dietaryTags: { include: { dietaryTag: { select: { id: true, name: true } } } },
                          },
                        },
                        portions: {
                          where: { portionSize: { active: true } },
                          include: { portionSize: { select: { name: true } } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    const menuCategories = [];
    for (const category of categories) {
      const dishes = [];
      for (const dish of category.dishes) {
        let dishPrice: Prisma.Decimal;
        try {
          dishPrice = await this.pricing.resolveDishPriceForTier(priceTierId, dish.id);
        } catch (error) {
          if (error instanceof BadRequestException) continue;
          throw error;
        }
        const groups = [];
        let unavailableRequiredGroup = false;
        for (const link of dish.optionGroups) {
          const options = [];
          for (const optionLink of link.optionGroup.options) {
            const price = await this.pricing.resolveOptionPriceForTier(priceTierId, optionLink.option.id).catch((error: unknown) => {
              if (error instanceof BadRequestException) return null;
              throw error;
            });
            if (price !== null) options.push({
              id: optionLink.option.id,
              name: optionLink.option.name,
              price: price.toFixed(2),
              allergens: optionLink.option.allergens.map(({ allergen }) => allergen.name),
              dietaryTags: optionLink.option.dietaryTags.map(({ dietaryTag }) => dietaryTag.name),
              portions: optionLink.portions.map((portion) => ({
                id: portion.id,
                portionSizeId: portion.portionSizeId,
                name: portion.portionSize.name,
                extraPrice: portion.extraPrice.toFixed(2),
              })),
            });
          }
          if (link.optionGroup.required && options.length < Math.max(1, link.optionGroup.minSelections)) {
            unavailableRequiredGroup = true;
          }
          groups.push({
            id: link.optionGroup.id,
            name: link.optionGroup.name,
            required: link.optionGroup.required,
            minSelections: link.optionGroup.minSelections,
            maxSelections: link.optionGroup.maxSelections,
            usesPortions: link.optionGroup.usesPortions,
            options,
          });
        }
        if (!unavailableRequiredGroup) dishes.push({
          id: dish.id, name: dish.name, description: dish.description, imageUrl: dish.imageUrl,
          sku: dish.sku, temperature: dish.temperature, minimumOrderQuantity: dish.minimumOrderQuantity,
          kitchenStation: dish.kitchenStation, price: dishPrice.toFixed(2),
          allergens: dish.allergens.map(({ allergen }) => allergen.name),
          dietaryTags: dish.dietaryTags.map(({ dietaryTag }) => dietaryTag.name),
          optionGroups: groups,
        });
      }
      if (dishes.length) menuCategories.push({ id: category.id, name: category.name, description: category.description, dishes });
    }
    return {
      company: {
        id: employee.company.id, name: employee.company.name,
        defaultDeliveryTime: employee.company.defaultDeliveryTime
          ? formatTime(employee.company.defaultDeliveryTime) : null,
        deliveryMinutes: employee.company.deliveryMinutes,
        defaultPackaging: employee.company.defaultPackaging,
        driverInstructions: employee.company.driverInstructions,
        addresses: employee.company.addresses,
        priceTierId,
        canDeliverOnSelectedDate: query.deliveryDate
          ? employee.company.deliveryWorkingDays.includes(getWeekday(query.deliveryDate)) &&
            employee.company.holidays.length === 0
          : null,
      },
      employee: {
        id: employee.id, name: employee.name, email: employee.email,
        canChooseDeliveryAddress: employee.canChooseDeliveryAddress,
        canChangeDeliveryTime: employee.canChangeDeliveryTime,
        canChangePackaging: employee.canChangePackaging,
        allergens: employee.allergens.map(({ allergen }) => allergen.name),
        dietaryPreferences: employee.dietaryPreferences.map(({ dietaryTag }) => dietaryTag.name),
      },
      categories: menuCategories,
    };
  }

  private dishData(dto: DishDto): Prisma.DishUncheckedCreateInput {
    return {
      categoryId: dto.categoryId,
      name: dto.name.trim(),
      description: dto.description,
      imageUrl: dto.imageUrl,
      sku: dto.sku.trim(),
      temperature: dto.temperature.trim().toUpperCase(),
      costPrice: new Prisma.Decimal(dto.costPrice),
      displayOrder: dto.displayOrder ?? 0,
      minimumOrderQuantity: dto.minimumOrderQuantity ?? 1,
      active: dto.active ?? true,
      kitchenStation: dto.kitchenStation,
    };
  }

  private async validateDish(dto: DishDto) {
    const [category, allergens, tags, groups, station] = await Promise.all([
      this.prisma.category.findUnique({ where: { id: dto.categoryId }, select: { id: true } }),
      this.prisma.allergen.count({ where: { id: { in: dto.allergenIds ?? [] } } }),
      this.prisma.dietaryTag.count({ where: { id: { in: dto.dietaryTagIds ?? [] } } }),
      this.prisma.optionGroup.count({ where: { id: { in: dto.optionGroupIds ?? [] } } }),
      dto.kitchenStation
        ? this.prisma.kitchenStationReference.findFirst({
            where: { name: dto.kitchenStation.trim(), active: true },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);
    if (!category) throw new NotFoundException('Category was not found');
    if (allergens !== new Set(dto.allergenIds ?? []).size) throw new BadRequestException('One or more allergens were not found');
    if (tags !== new Set(dto.dietaryTagIds ?? []).size) throw new BadRequestException('One or more dietary tags were not found');
    if (groups !== new Set(dto.optionGroupIds ?? []).size) throw new BadRequestException('One or more option groups were not found');
    if (dto.kitchenStation && !station) throw new BadRequestException('Kitchen station is not active or was not found');
    if (new Prisma.Decimal(dto.costPrice).isNegative()) throw new BadRequestException('Cost price cannot be negative');
  }

  private async replaceDishRelations(tx: Prisma.TransactionClient, dishId: number, dto: DishDto) {
    await Promise.all([
      tx.dishAllergen.deleteMany({ where: { dishId } }),
      tx.dishDietaryTag.deleteMany({ where: { dishId } }),
      tx.dishOptionGroup.deleteMany({ where: { dishId } }),
    ]);
    if (dto.allergenIds?.length) await tx.dishAllergen.createMany({ data: [...new Set(dto.allergenIds)].map((allergenId) => ({ dishId, allergenId })) });
    if (dto.dietaryTagIds?.length) await tx.dishDietaryTag.createMany({ data: [...new Set(dto.dietaryTagIds)].map((dietaryTagId) => ({ dishId, dietaryTagId })) });
    if (dto.optionGroupIds?.length) await tx.dishOptionGroup.createMany({ data: [...new Set(dto.optionGroupIds)].map((optionGroupId, displayOrder) => ({ dishId, optionGroupId, displayOrder })) });
  }

  private async replaceOptionRelations(tx: Prisma.TransactionClient, optionId: number, dto: OptionDto) {
    await Promise.all([
      tx.optionAllergen.deleteMany({ where: { optionId } }),
      tx.optionDietaryTag.deleteMany({ where: { optionId } }),
    ]);
    if (dto.allergenIds?.length) await tx.optionAllergen.createMany({ data: [...new Set(dto.allergenIds)].map((allergenId) => ({ optionId, allergenId })) });
    if (dto.dietaryTagIds?.length) await tx.optionDietaryTag.createMany({ data: [...new Set(dto.dietaryTagIds)].map((dietaryTagId) => ({ optionId, dietaryTagId })) });
  }

  private async replaceGroupRelations(tx: Prisma.TransactionClient, groupId: number, dto: OptionGroupDto) {
    await Promise.all([
      tx.optionGroupOption.deleteMany({ where: { optionGroupId: groupId } }),
      tx.dishOptionGroup.deleteMany({ where: { optionGroupId: groupId } }),
    ]);
    if (dto.optionIds?.length) await tx.optionGroupOption.createMany({ data: [...new Set(dto.optionIds)].map((optionId, displayOrder) => ({ optionGroupId: groupId, optionId, displayOrder })) });
    if (dto.portions?.length) {
      await tx.optionPortion.createMany({
        data: dto.portions.map((portion) => ({
          optionGroupId: groupId,
          optionId: portion.optionId,
          portionSizeId: portion.portionSizeId,
          extraPrice: new Prisma.Decimal(portion.extraPrice),
        })),
      });
    }
    if (dto.dishIds?.length) await tx.dishOptionGroup.createMany({ data: [...new Set(dto.dishIds)].map((dishId, displayOrder) => ({ dishId, optionGroupId: groupId, displayOrder })) });
  }

  private async validateGroup(dto: OptionGroupDto) {
    if ((dto.required ?? false) && (dto.maxSelections ?? Infinity) < (dto.minSelections ?? 1)) {
      throw new BadRequestException('Maximum selections cannot be less than minimum selections');
    }
    const [options, dishes] = await this.prisma.$transaction([
      this.prisma.option.count({ where: { id: { in: dto.optionIds ?? [] } } }),
      this.prisma.dish.count({ where: { id: { in: dto.dishIds ?? [] } } }),
    ]);
    if (options !== new Set(dto.optionIds ?? []).size) throw new BadRequestException('One or more options were not found');
    if (dishes !== new Set(dto.dishIds ?? []).size) throw new BadRequestException('One or more dishes were not found');
    if (dto.usesPortions) {
      const optionIds = [...new Set(dto.optionIds ?? [])].sort((a, b) => a - b);
      const portionSizeIds = [...new Set((dto.portions ?? []).map((portion) => portion.portionSizeId))].sort((a, b) => a - b);
      const portionSizeCount = await this.prisma.portionSizeReference.count({
        where: { id: { in: portionSizeIds }, active: true },
      });
      if (optionIds.length === 0 || portionSizeIds.length === 0) {
        throw new BadRequestException('Portion groups need options and at least one portion size');
      }
      if (portionSizeCount !== portionSizeIds.length) {
        throw new BadRequestException('One or more portion sizes are inactive or were not found');
      }
      for (const optionId of optionIds) {
        const supportedIds = (dto.portions ?? [])
          .filter((portion) => portion.optionId === optionId)
          .map((portion) => portion.portionSizeId)
          .sort();
        if (supportedIds.join('|') !== portionSizeIds.join('|')) {
          throw new BadRequestException('Every option in a portion group must support the same portion sizes');
        }
      }
      if ((dto.portions ?? []).length !== optionIds.length * portionSizeIds.length) {
        throw new BadRequestException('Each option must have exactly one price for each selected portion size');
      }
      if ((dto.portions ?? []).some((portion) => new Prisma.Decimal(portion.extraPrice).isNegative())) {
        throw new BadRequestException('Portion extra prices cannot be negative');
      }
    } else if (dto.portions?.length) {
      throw new BadRequestException('Portion prices require portions to be enabled for the group');
    }
  }

  private async validateReferenceIds(allergenIds: number[], dietaryTagIds: number[]) {
    const [allergens, tags] = await this.prisma.$transaction([
      this.prisma.allergen.count({ where: { id: { in: allergenIds } } }),
      this.prisma.dietaryTag.count({ where: { id: { in: dietaryTagIds } } }),
    ]);
    if (allergens !== new Set(allergenIds).size) throw new BadRequestException('One or more allergens were not found');
    if (tags !== new Set(dietaryTagIds).size) throw new BadRequestException('One or more dietary tags were not found');
  }

  private async requireCategory(id: number) {
    if (!(await this.prisma.category.findUnique({ where: { id }, select: { id: true } }))) {
      throw new NotFoundException('Category was not found');
    }
  }

  private rethrow(error: unknown, conflictMessage: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException(conflictMessage);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      throw new BadRequestException('A selected related record does not exist');
    }
    throw error;
  }
}

type DishWithRelations = Prisma.DishGetPayload<{ include: typeof DISH_INCLUDE }>;

function formatDish(dish: DishWithRelations) {
  return {
    ...dish,
    costPrice: dish.costPrice.toFixed(2),
    allergens: dish.allergens.map(({ allergen }) => allergen),
    dietaryTags: dish.dietaryTags.map(({ dietaryTag }) => dietaryTag),
    optionGroups: dish.optionGroups.map((link) => ({
      ...link.optionGroup,
      displayOrder: link.displayOrder,
      options: link.optionGroup.options.map((optionLink) => ({
        ...optionLink.option,
        displayOrder: optionLink.displayOrder,
        portions: optionLink.portions.map(formatPortion),
      })),
    })),
  };
}

function formatTime(value: Date) {
  return `${String(value.getUTCHours()).padStart(2, '0')}:${String(value.getUTCMinutes()).padStart(2, '0')}`;
}

function formatOptionGroup<T extends {
  options: Array<{
    portions: Array<{
      portionSizeId: number;
      portionSize: { name: string; active: boolean };
      extraPrice: Prisma.Decimal;
    }>;
  }>;
}>(group: T) {
  return {
    ...group,
    options: group.options.map((option) => ({
      ...option,
      portions: option.portions.map(formatPortion),
    })),
  };
}

function formatPortion<T extends {
  portionSizeId: number;
  portionSize: { name: string; active: boolean };
  extraPrice: Prisma.Decimal;
}>(portion: T) {
  return {
    ...portion,
    name: portion.portionSize.name,
    active: portion.portionSize.active,
    extraPrice: portion.extraPrice.toFixed(2),
  };
}
