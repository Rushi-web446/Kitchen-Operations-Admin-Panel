import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, PricingRuleType } from '@prisma/client';

type PricingItem =
  | { kind: 'dish'; id: number; cost: Prisma.Decimal }
  | { kind: 'option'; id: number };

const FIVE_CENTS = new Prisma.Decimal('0.05');
const ONE_HUNDRED = new Prisma.Decimal('100');

@Injectable()
export class OrderPricingService {
  effectiveDishPrice(
    tx: Prisma.TransactionClient,
    dishId: number,
    cost: Prisma.Decimal,
    priceTierId: number,
  ): Promise<Prisma.Decimal | null> {
    return this.resolve(tx, { kind: 'dish', id: dishId, cost }, priceTierId, new Set());
  }

  effectiveOptionPrice(
    tx: Prisma.TransactionClient,
    optionId: number,
    priceTierId: number,
  ): Promise<Prisma.Decimal | null> {
    return this.resolve(tx, { kind: 'option', id: optionId }, priceTierId, new Set());
  }

  private async resolve(
    tx: Prisma.TransactionClient,
    item: PricingItem,
    priceTierId: number,
    visited: Set<number>,
  ): Promise<Prisma.Decimal | null> {
    if (visited.has(priceTierId)) {
      throw new BadRequestException('Pricing tier derivation contains a cycle');
    }
    visited.add(priceTierId);

    const override =
      item.kind === 'dish'
        ? await tx.dishPrice.findUnique({
            where: { dishId_priceTierId: { dishId: item.id, priceTierId } },
            select: { overridePrice: true },
          })
        : await tx.optionPrice.findUnique({
            where: { optionId_priceTierId: { optionId: item.id, priceTierId } },
            select: { overridePrice: true },
          });

    if (override?.overridePrice !== null && override?.overridePrice !== undefined) {
      return this.roundUpToFiveCents(override.overridePrice);
    }

    const tier = await tx.priceTier.findUnique({
      where: { id: priceTierId },
      select: {
        pricingRuleType: true,
        baseTierId: true,
        multiplier: true,
        markupPercent: true,
      },
    });
    if (!tier) {
      throw new BadRequestException('The applicable price tier does not exist');
    }

    if (tier.pricingRuleType === PricingRuleType.COST_MULTIPLIER) {
      if (item.kind !== 'dish' || !tier.multiplier) return null;
      return this.roundUpToFiveCents(item.cost.mul(tier.multiplier));
    }

    if (tier.pricingRuleType === PricingRuleType.TIER_MARKUP) {
      if (tier.baseTierId === null || tier.markupPercent === null) {
        throw new BadRequestException('The price tier markup configuration is invalid');
      }

      const basePrice = await this.resolve(tx, item, tier.baseTierId, visited);
      if (basePrice === null) return null;

      const markupMultiplier = tier.markupPercent.div(ONE_HUNDRED).plus(1);
      return this.roundUpToFiveCents(basePrice.mul(markupMultiplier));
    }

    return null;
  }

  roundUpToFiveCents(amount: Prisma.Decimal): Prisma.Decimal {
    if (amount.isNegative()) {
      throw new BadRequestException('Pricing cannot produce a negative amount');
    }
    return amount.div(FIVE_CENTS).ceil().mul(FIVE_CENTS).toDecimalPlaces(2);
  }
}