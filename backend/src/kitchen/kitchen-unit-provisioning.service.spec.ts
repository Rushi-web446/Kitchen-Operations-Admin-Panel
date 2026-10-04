import { KitchenUnitStatus, Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { KitchenUnitProvisioningService } from './kitchen-unit-provisioning.service';

describe('KitchenUnitProvisioningService', () => {
  it('creates one not-started unit per combination with the station snapshot', async () => {
    const tx = {
      orderCombination: {
        findMany: vi.fn(async () => [
          {
            id: 101,
            orderLine: { dish: { kitchenStation: 'GRILL' } },
          },
          {
            id: 102,
            orderLine: { dish: { kitchenStation: null } },
          },
        ]),
      },
      kitchenUnit: {
        createMany: vi.fn(async () => ({ count: 2 })),
      },
    } as unknown as Prisma.TransactionClient;
    const service = new KitchenUnitProvisioningService();

    const count = await service.ensureForConfirmedOrder(tx, 20);

    expect(count).toBe(2);
    expect(tx.kitchenUnit.createMany).toHaveBeenCalledWith({
      data: [
        {
          orderCombinationId: 101,
          kitchenStation: 'GRILL',
          status: KitchenUnitStatus.NOT_STARTED,
        },
        {
          orderCombinationId: 102,
          kitchenStation: 'UNASSIGNED',
          status: KitchenUnitStatus.NOT_STARTED,
        },
      ],
      skipDuplicates: true,
    });
  });

  it('does not create units when the order has no combinations', async () => {
    const tx = {
      orderCombination: { findMany: vi.fn(async () => []) },
      kitchenUnit: { createMany: vi.fn() },
    } as unknown as Prisma.TransactionClient;

    await expect(
      new KitchenUnitProvisioningService().ensureForConfirmedOrder(tx, 20),
    ).resolves.toBe(0);
    expect(tx.kitchenUnit.createMany).not.toHaveBeenCalled();
  });
});