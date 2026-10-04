import { Prisma, PricingRuleType } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { OrderPricingService } from './order-pricing.service';

function pricingClient(overrides: {
  dishOverride?: string | null;
  optionOverride?: string | null;
  tiers: Map<number, {
    pricingRuleType: PricingRuleType;
    baseTierId: number | null;
    multiplier: string | null;
    markupPercent: string | null;
  }>;
}) {
  return {
    dishPrice: {
      findUnique: vi.fn(async () =>
        overrides.dishOverride === undefined
          ? null
          : { overridePrice: overrides.dishOverride === null ? null : new Prisma.Decimal(overrides.dishOverride) },
      ),
    },
    optionPrice: {
      findUnique: vi.fn(async () =>
        overrides.optionOverride === undefined
          ? null
          : { overridePrice: overrides.optionOverride === null ? null : new Prisma.Decimal(overrides.optionOverride) },
      ),
    },
    priceTier: {
      findUnique: vi.fn(async ({ where }: { where: { id: number } }) => {
        const tier = overrides.tiers.get(where.id);
        return tier
          ? {
              pricingRuleType: tier.pricingRuleType,
              baseTierId: tier.baseTierId,
              multiplier: tier.multiplier ? new Prisma.Decimal(tier.multiplier) : null,
              markupPercent: tier.markupPercent ? new Prisma.Decimal(tier.markupPercent) : null,
            }
          : null;
      }),
    },
  } as unknown as Prisma.TransactionClient;
}

describe('OrderPricingService', () => {
  const pricing = new OrderPricingService();

  it('calculates cost multiplier prices with decimal arithmetic and five-cent rounding', async () => {
    const tx = pricingClient({
      tiers: new Map([[1, {
        pricingRuleType: PricingRuleType.COST_MULTIPLIER,
        baseTierId: null,
        multiplier: '2.4',
        markupPercent: null,
      }]]),
    });

    const result = await pricing.effectiveDishPrice(
      tx,
      7,
      new Prisma.Decimal('4.31'),
      1,
    );
    expect(result?.toFixed(2)).toBe('10.35');
  });

  it('prefers an explicit price override over tier derivation', async () => {
    const tx = pricingClient({
      dishOverride: '10.01',
      tiers: new Map([[1, {
        pricingRuleType: PricingRuleType.COST_MULTIPLIER,
        baseTierId: null,
        multiplier: '2',
        markupPercent: null,
      }]]),
    });

    const result = await pricing.effectiveDishPrice(
      tx,
      7,
      new Prisma.Decimal('4.00'),
      1,
    );
    expect(result?.toFixed(2)).toBe('10.05');
  });

  it('supports tier markup and returns no price for unsupported option cost derivation', async () => {
    const tx = pricingClient({
      dishOverride: '10.00',
      tiers: new Map([
        [1, {
          pricingRuleType: PricingRuleType.TIER_MARKUP,
          baseTierId: 2,
          multiplier: null,
          markupPercent: '10',
        }],
        [2, {
          pricingRuleType: PricingRuleType.MANUAL,
          baseTierId: null,
          multiplier: null,
          markupPercent: null,
        }],
      ]),
    });

    const dishResult = await pricing.effectiveDishPrice(
      tx,
      4,
      new Prisma.Decimal('5.00'),
      1,
    );
    const optionResult = await pricing.effectiveOptionPrice(tx, 3, 1);
    expect(dishResult?.toFixed(2)).toBe('10.00');
    expect(optionResult).toBeNull();
  });

  it('applies tier markup to a base-tier price', async () => {
    const tiers = new Map([
      [1, {
        pricingRuleType: PricingRuleType.TIER_MARKUP,
        baseTierId: 2,
        multiplier: null,
        markupPercent: '10',
      }],
      [2, {
        pricingRuleType: PricingRuleType.MANUAL,
        baseTierId: null,
        multiplier: null,
        markupPercent: null,
      }],
    ]);
    const tx = {
      dishPrice: {
        findUnique: vi.fn(async ({
          where,
        }: { where: { dishId_priceTierId: { priceTierId: number } } }) =>
          where.dishId_priceTierId.priceTierId === 2
            ? { overridePrice: new Prisma.Decimal('10.00') }
            : null,
        ),
      },
      optionPrice: { findUnique: vi.fn(async () => null) },
      priceTier: {
        findUnique: vi.fn(async ({ where }: { where: { id: number } }) => {
          const tier = tiers.get(where.id);
          return tier
            ? {
                pricingRuleType: tier.pricingRuleType,
                baseTierId: tier.baseTierId,
                multiplier: tier.multiplier
                  ? new Prisma.Decimal(tier.multiplier)
                  : null,
                markupPercent: tier.markupPercent
                  ? new Prisma.Decimal(tier.markupPercent)
                  : null,
              }
            : null;
        }),
      },
    } as unknown as Prisma.TransactionClient;

    const result = await pricing.effectiveDishPrice(
      tx,
      4,
      new Prisma.Decimal('5.00'),
      1,
    );
    expect(result?.toFixed(2)).toBe('11.00');
  });
});