import { Injectable } from '@nestjs/common';
import { Prisma, KitchenUnitStatus } from '@prisma/client';

@Injectable()
export class KitchenUnitProvisioningService {
  async ensureForConfirmedOrder(
    tx: Prisma.TransactionClient,
    orderId: number,
  ): Promise<number> {
    const combinations = await tx.orderCombination.findMany({
      where: { orderLine: { orderId } },
      select: {
        id: true,
        orderLine: {
          select: { dish: { select: { kitchenStation: true } } },
        },
      },
    });

    if (combinations.length === 0) return 0;

    const created = await tx.kitchenUnit.createMany({
      data: combinations.map((combination) => ({
        orderCombinationId: combination.id,
        kitchenStation:
          combination.orderLine.dish.kitchenStation ?? 'UNASSIGNED',
        status: KitchenUnitStatus.NOT_STARTED,
      })),
      skipDuplicates: true,
    });

    return created.count;
  }
}