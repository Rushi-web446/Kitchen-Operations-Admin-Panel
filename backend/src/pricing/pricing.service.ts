import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, PriceTier } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { OrderPricingService } from '../orders/order-pricing.service';

const FIVE_CENTS = new Prisma.Decimal('0.05');

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderPricing: OrderPricingService,
  ) {}

  async listTiers() {
    return this.prisma.priceTier.findMany({
      orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        isDefault: true,
        pricingRuleType: true,
        baseTierId: true,
        multiplier: true,
        markupPercent: true,
      },
    });
  }

  async listDishPrices(priceTierId: number) {
    const tier = await this.prisma.priceTier.findUnique({ where: { id: priceTierId }, select: { id: true, name: true } });
    if (!tier) throw new NotFoundException('Price tier was not found');
    const dishes = await this.prisma.dish.findMany({
      orderBy: [{ category: { displayOrder: 'asc' } }, { name: 'asc' }],
      select: {
        id: true, name: true, sku: true, active: true, costPrice: true,
        category: { select: { name: true } },
        prices: { where: { priceTierId }, select: { overridePrice: true } },
      },
    });
    return {
      tier,
      dishes: await Promise.all(dishes.map(async (dish) => {
        const effective = await this.orderPricing.effectiveDishPrice(
          this.prisma, dish.id, dish.costPrice, priceTierId,
        );
        return {
          id: dish.id,
          name: dish.name,
          sku: dish.sku,
          category: dish.category.name,
          active: dish.active,
          costPrice: dish.costPrice.toFixed(2),
          overridePrice: dish.prices[0]?.overridePrice?.toFixed(2) ?? null,
          effectivePrice: effective?.toFixed(2) ?? null,
          state: effective === null ? 'MISSING' : dish.prices[0]?.overridePrice !== null &&
            dish.prices[0]?.overridePrice !== undefined ? 'OVERRIDE' : 'DERIVED',
        };
      })),
    };
  }

  async updateDishPrices(priceTierId: number, entries: Array<{ itemId: number; overridePrice?: string }>) {
    const tier = await this.prisma.priceTier.findUnique({
      where: { id: priceTierId },
      select: { id: true, pricingRuleType: true },
    });
    if (!tier) throw new NotFoundException('Price tier was not found');
    const ids = entries.map((entry) => entry.itemId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('A dish can only appear once per update');
    const count = await this.prisma.dish.count({ where: { id: { in: ids } } });
    if (count !== ids.length) throw new BadRequestException('One or more dishes were not found');

    await this.prisma.$transaction(async (tx) => {
      for (const entry of entries) {
        const overridePrice = entry.overridePrice === undefined ? null : toDecimal(entry.overridePrice);
        if (overridePrice?.isNegative()) throw new BadRequestException('Price cannot be negative');
        await tx.dishPrice.upsert({
          where: { dishId_priceTierId: { dishId: entry.itemId, priceTierId } },
          update: { overridePrice },
          create: { dishId: entry.itemId, priceTierId, overridePrice },
        });
      }
    });
    return this.listDishPrices(priceTierId);
  }

  async listOptionPrices(priceTierId: number) {
    const tier = await this.prisma.priceTier.findUnique({ where: { id: priceTierId }, select: { id: true, name: true } });
    if (!tier) throw new NotFoundException('Price tier was not found');
    const options = await this.prisma.option.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, active: true, costPrice: true,
        prices: { where: { priceTierId }, select: { overridePrice: true } },
      },
    });
    return {
      tier,
      options: await Promise.all(options.map(async (option) => {
        const effective = await this.orderPricing.effectiveOptionPrice(this.prisma, option.id, priceTierId);
        return {
          id: option.id,
          name: option.name,
          active: option.active,
          costPrice: option.costPrice.toFixed(2),
          overridePrice: option.prices[0]?.overridePrice?.toFixed(2) ?? null,
          effectivePrice: effective?.toFixed(2) ?? null,
          state: effective === null ? 'MISSING' : option.prices[0]?.overridePrice !== null &&
            option.prices[0]?.overridePrice !== undefined ? 'OVERRIDE' : 'DERIVED',
        };
      })),
    };
  }

  async updateOptionPrices(priceTierId: number, entries: Array<{ itemId: number; overridePrice?: string }>) {
    const tier = await this.prisma.priceTier.findUnique({ where: { id: priceTierId }, select: { id: true } });
    if (!tier) throw new NotFoundException('Price tier was not found');
    const ids = entries.map((entry) => entry.itemId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('An option can only appear once per update');
    const count = await this.prisma.option.count({ where: { id: { in: ids } } });
    if (count !== ids.length) throw new BadRequestException('One or more options were not found');
    await this.prisma.$transaction(async (tx) => {
      for (const entry of entries) {
        const overridePrice = entry.overridePrice === undefined ? null : toDecimal(entry.overridePrice);
        if (overridePrice?.isNegative()) throw new BadRequestException('Price cannot be negative');
        await tx.optionPrice.upsert({
          where: { optionId_priceTierId: { optionId: entry.itemId, priceTierId } },
          update: { overridePrice },
          create: { optionId: entry.itemId, priceTierId, overridePrice },
        });
      }
    });
    return this.listOptionPrices(priceTierId);
  }

  async resolveCompanyPriceTier(companyId: number, tx: Prisma.TransactionClient = this.prisma) {
    const company = await tx.company.findUnique({
      where: { id: companyId },
      select: { id: true, priceTierId: true },
    });
    if (!company) {
      throw new NotFoundException('Company was not found');
    }

    if (company.priceTierId !== null) {
      const tier = await tx.priceTier.findUnique({
        where: { id: company.priceTierId },
        select: { id: true },
      });
      if (!tier) {
        throw new BadRequestException('The company price tier does not exist');
      }
      return tier.id;
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

  async resolveDishPrice(
    companyId: number,
    dishId: number,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const priceTierId = await this.resolveCompanyPriceTier(companyId, tx);
    return this.resolveDishPriceForTier(priceTierId, dishId, tx);
  }

  async resolveDishPriceForTier(
    priceTierId: number,
    dishId: number,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const dish = await tx.dish.findUnique({
      where: { id: dishId },
      select: { id: true, costPrice: true },
    });
    if (!dish) {
      throw new NotFoundException('Dish was not found');
    }
    const price = await this.orderPricing.effectiveDishPrice(tx, dish.id, dish.costPrice, priceTierId);
    if (price === null) {
      throw new BadRequestException(`No effective price is configured for the selected dish`);
    }
    return price;
  }

  async resolveOptionPrice(
    companyId: number,
    optionId: number,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const priceTierId = await this.resolveCompanyPriceTier(companyId, tx);
    return this.resolveOptionPriceForTier(priceTierId, optionId, tx);
  }

  async resolveOptionPriceForTier(
    priceTierId: number,
    optionId: number,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const option = await tx.option.findUnique({
      where: { id: optionId },
      select: { id: true },
    });
    if (!option) {
      throw new NotFoundException('Option was not found');
    }
    const price = await this.orderPricing.effectiveOptionPrice(tx, option.id, priceTierId);
    if (price === null) {
      throw new BadRequestException(`No effective price is configured for the selected option`);
    }
    return price;
  }

  async calculateCombinationPrice(
    dishPrice: Prisma.Decimal | string | number,
    optionPrices: Array<Prisma.Decimal | string | number>,
    quantity: number,
  ) {
    const base = toDecimal(dishPrice);
    const unitPrice = optionPrices.reduce<Prisma.Decimal>(
      (sum, current) => sum.plus(toDecimal(current)),
      base,
    );

    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new BadRequestException('Combination quantity must be a positive integer');
    }

    return {
      unitPrice: this.roundUpToFiveCents(unitPrice),
      totalPrice: this.roundUpToFiveCents(unitPrice.mul(quantity)),
    };
  }

  async calculateOrderTotal(
    lines: Array<{ quantity: number; unitPrice: Prisma.Decimal | string | number }>,
  ) {
    return lines.reduce(
      (sum, line) => sum.plus(toDecimal(line.unitPrice).mul(line.quantity)),
      new Prisma.Decimal(0),
    );
  }

  private roundUpToFiveCents(amount: Prisma.Decimal) {
    if (amount.isNegative()) {
      throw new BadRequestException('Pricing cannot produce a negative amount');
    }
    return amount.div(FIVE_CENTS).ceil().mul(FIVE_CENTS).toDecimalPlaces(2);
  }

}

function toDecimal(value: Prisma.Decimal | string | number): Prisma.Decimal {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}
