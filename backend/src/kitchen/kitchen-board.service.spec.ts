import {
  KitchenUnitStatus,
  OrderStatus,
} from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../database/prisma.service';
import { KitchenBoardService } from './kitchen-board.service';

describe('KitchenBoardService', () => {
  it('projects confirmed work, progress, filters, and derived risk', async () => {
    const order = {
      id: 91,
      status: OrderStatus.CONFIRMED,
      deliveryDate: new Date('2026-10-03T00:00:00.000Z'),
      deliveryTime: new Date('1970-01-01T12:00:00.000Z'),
      plannedKitchenReadyAt: new Date('2026-10-03T05:00:00.000Z'),
      kitchenStartedAt: new Date('2026-10-03T04:30:00.000Z'),
      kitchenReadyAt: null,
      employee: { id: 5, name: 'Asha Rao', email: 'asha@example.test' },
      company: { id: 3, name: 'Test Company' },
      lines: [
        {
          dishNameSnapshot: 'Paneer Bowl',
          dishSkuSnapshot: 'PANEER-1',
          combinations: [
            {
              id: 10,
              quantity: 3,
              options: [{ optionId: 7, optionNameSnapshot: 'Brown rice' }],
              kitchenUnits: [
                {
                  id: 20,
                  orderCombinationId: 10,
                  kitchenStation: 'GRILL',
                  status: KitchenUnitStatus.DONE,
                  startedAt: new Date('2026-10-03T04:30:00.000Z'),
                  doneAt: new Date('2026-10-03T04:50:00.000Z'),
                },
              ],
            },
            {
              id: 11,
              quantity: 2,
              options: [],
              kitchenUnits: [
                {
                  id: 21,
                  orderCombinationId: 11,
                  kitchenStation: 'COLD',
                  status: KitchenUnitStatus.PENDING,
                  startedAt: null,
                  doneAt: null,
                },
              ],
            },
          ],
        },
      ],
    };
    const findMany = vi.fn(async () => [order]);
    const prisma = { order: { findMany } } as unknown as PrismaService;
    const service = new KitchenBoardService(prisma);
    const now = new Date('2026-10-03T05:05:00.000Z');

    const [result] = await service.list(
      { deliveryDate: '2026-10-03', kitchenStation: 'COLD' },
      now,
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: OrderStatus.CONFIRMED }),
      }),
    );
    expect(result.units).toHaveLength(1);
    expect(result.units[0]).toMatchObject({
      id: 21,
      dishName: 'Paneer Bowl',
      quantity: 2,
      station: 'COLD',
      status: KitchenUnitStatus.PENDING,
    });
    expect(result.progress).toEqual({ completedUnits: 1, totalUnits: 2 });
    expect(result.isAtRisk).toBe(true);
  });
});