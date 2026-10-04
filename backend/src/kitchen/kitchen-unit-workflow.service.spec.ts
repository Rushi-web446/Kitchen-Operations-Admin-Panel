import {
  ConflictException,
} from '@nestjs/common';
import {
  KitchenUnitStatus,
  OrderStatus,
  Prisma,
} from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../database/prisma.service';
import { KitchenUnitWorkflowService } from './kitchen-unit-workflow.service';

type UnitState = {
  id: number;
  orderCombinationId: number;
  quantity: number;
  kitchenStation: string;
  status: KitchenUnitStatus;
  startedAt: Date | null;
  doneAt: Date | null;
};

function makeWorkflow(
  initialUnits: UnitState[],
  orderStatus = OrderStatus.CONFIRMED,
) {
  const units = new Map(initialUnits.map((unit) => [unit.id, { ...unit }]));
  const order = {
    id: 77,
    status: orderStatus,
    kitchenStartedAt: null as Date | null,
    kitchenReadyAt: null as Date | null,
  };
  let transactionQueue = Promise.resolve();

  const tx = {
    $queryRaw: vi.fn(async () => [{ id: order.id }]),
    kitchenUnit: {
      findUnique: vi.fn(async ({ where }: { where: { id: number } }) => {
        const unit = units.get(where.id);
        if (!unit) return null;
        if (units.size > 0) {
          return {
            ...unit,
            orderCombination: {
              quantity: unit.quantity,
              orderLine: {
                orderId: order.id,
                dishNameSnapshot: `Dish ${unit.id}`,
                dishSkuSnapshot: `SKU-${unit.id}`,
                order: { status: order.status },
              },
              options: [],
            },
          };
        }
        return null;
      }),
      updateMany: vi.fn(async ({
        where,
        data,
      }: {
        where: {
          id: number;
          status: KitchenUnitStatus | { in: KitchenUnitStatus[] };
        };
        data: Partial<UnitState>;
      }) => {
        const unit = units.get(where.id);
        const matchesStatus =
          typeof where.status === 'string'
            ? where.status === unit?.status
            : where.status.in.includes(unit?.status as KitchenUnitStatus);
        if (!unit || !matchesStatus) return { count: 0 };
        units.set(where.id, { ...unit, ...data });
        return { count: 1 };
      }),
      count: vi.fn(async ({
        where,
      }: {
        where: { status: { not: KitchenUnitStatus } };
      }) => [...units.values()].filter((unit) => unit.status !== where.status.not).length),
    },
    order: {
      updateMany: vi.fn(async ({
        where,
        data,
      }: {
        where: { id: number; kitchenStartedAt?: null; kitchenReadyAt?: null };
        data: { kitchenStartedAt?: Date; kitchenReadyAt?: Date };
      }) => {
        if (where.id !== order.id) return { count: 0 };
        if (where.kitchenStartedAt === null && order.kitchenStartedAt !== null) {
          return { count: 0 };
        }
        if (where.kitchenReadyAt === null && order.kitchenReadyAt !== null) {
          return { count: 0 };
        }
        Object.assign(order, data);
        return { count: 1 };
      }),
    },
  };

  const prisma = {
    $transaction: vi.fn(
      async (callback: (client: Prisma.TransactionClient) => Promise<unknown>) => {
        const previous = transactionQueue;
        let release!: () => void;
        transactionQueue = new Promise<void>((resolve) => {
          release = resolve;
        });
        await previous;
        try {
          return await callback(tx as unknown as Prisma.TransactionClient);
        } finally {
          release();
        }
      },
    ),
  } as unknown as PrismaService;

  return {
    service: new KitchenUnitWorkflowService(
      prisma,
      { ensureForConfirmedOrder: vi.fn().mockResolvedValue(0) } as never,
    ),
    order,
    units,
    tx,
  };
}

function unit(id: number, status = KitchenUnitStatus.NOT_STARTED): UnitState {
  return {
    id,
    orderCombinationId: id + 100,
    quantity: id + 1,
    kitchenStation: 'GRILL',
    status,
    startedAt: status === KitchenUnitStatus.STARTED ? new Date('2026-10-03T05:00:00.000Z') : null,
    doneAt: null,
  };
}

describe('KitchenUnitWorkflowService', () => {
  const firstNow = new Date('2026-10-03T05:00:00.000Z');

  it('starts a not-started unit and sets the order first-start timestamp', async () => {
    const { service, order, units } = makeWorkflow([unit(1)]);
    const result = await service.start(1, firstNow);

    expect(units.get(1)?.status).toBe(KitchenUnitStatus.STARTED);
    expect(units.get(1)?.startedAt).toEqual(firstNow);
    expect(order.kitchenStartedAt).toEqual(firstNow);
    expect(result.status).toBe(KitchenUnitStatus.STARTED);
  });

  it('does not overwrite the order first-start timestamp when a later unit starts', async () => {
    const { service, order } = makeWorkflow([unit(1), unit(2)]);
    await service.start(1, firstNow);
    const later = new Date('2026-10-03T05:05:00.000Z');
    await service.start(2, later);
    expect(order.kitchenStartedAt).toEqual(firstNow);
  });

  it('supports STARTED to DONE and preserves startedAt', async () => {
    const started = unit(1, KitchenUnitStatus.STARTED);
    const { service, units } = makeWorkflow([started]);
    const doneAt = new Date('2026-10-03T06:00:00.000Z');
    const response = await service.complete(1, doneAt);

    expect(units.get(1)?.status).toBe(KitchenUnitStatus.DONE);
    expect(units.get(1)?.startedAt).toEqual(started.startedAt);
    expect(units.get(1)?.doneAt).toEqual(doneAt);
    expect(response.doneAt).toBe(doneAt.toISOString());
  });

  it('supports NOT_STARTED to DONE and sets both timestamps', async () => {
    const { service, units, order } = makeWorkflow([unit(1)]);
    const doneAt = new Date('2026-10-03T06:00:00.000Z');
    await service.complete(1, doneAt);

    expect(units.get(1)?.status).toBe(KitchenUnitStatus.DONE);
    expect(units.get(1)?.startedAt).toEqual(doneAt);
    expect(units.get(1)?.doneAt).toEqual(doneAt);
    expect(order.kitchenStartedAt).toEqual(doneAt);
  });

  it('sets kitchenReadyAt only after every unit is done', async () => {
    const { service, order } = makeWorkflow([unit(1), unit(2)]);
    const firstDoneAt = new Date('2026-10-03T06:00:00.000Z');
    await service.complete(1, firstDoneAt);
    expect(order.kitchenReadyAt).toBeNull();

    const lastDoneAt = new Date('2026-10-03T06:05:00.000Z');
    await service.complete(2, lastDoneAt);
    expect(order.kitchenReadyAt).toEqual(lastDoneAt);
  });

  it('serializes simultaneous final completions and sets the ready timestamp', async () => {
    const { service, order, units } = makeWorkflow([unit(1), unit(2)]);
    const completedAt = new Date('2026-10-03T06:00:00.000Z');
    await Promise.all([
      service.complete(1, completedAt),
      service.complete(2, new Date(completedAt.getTime() + 1)),
    ]);

    expect([...units.values()].every((item) => item.status === KitchenUnitStatus.DONE)).toBe(true);
    expect(order.kitchenReadyAt).not.toBeNull();
  });

  it('force-completes units provisioned during the same transaction', async () => {
    const now = new Date('2026-10-03T06:10:00.000Z');
    const units: Array<{
      id: number;
      status: KitchenUnitStatus;
      startedAt: Date | null;
      doneAt: Date | null;
    }> = [];
    const tx = {
      $queryRaw: vi.fn(async () => [{ id: 77 }]),
      order: {
        findUnique: vi.fn(async () => ({
          id: 77,
          status: OrderStatus.CONFIRMED,
          kitchenStartedAt: null,
          kitchenReadyAt: null,
        })),
        update: vi.fn(async ({ data }: { data: { kitchenStartedAt: Date; kitchenReadyAt: Date } }) => data),
      },
      kitchenUnit: {
        findMany: vi.fn(async () => units.map((unit) => ({ ...unit }))),
        updateMany: vi.fn(async ({ where, data }: {
          where: { id: number; status: { in: KitchenUnitStatus[] } };
          data: { status: KitchenUnitStatus; startedAt: Date; doneAt: Date };
        }) => {
          const item = units.find((unit) => unit.id === where.id);
          if (!item || !where.status.in.includes(item.status)) return { count: 0 };
          Object.assign(item, data);
          return { count: 1 };
        }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: Prisma.TransactionClient) => Promise<unknown>) =>
        callback(tx as unknown as Prisma.TransactionClient),
      ),
    } as unknown as PrismaService;
    const service = new KitchenUnitWorkflowService(prisma, {
      ensureForConfirmedOrder: vi.fn(async () => {
        units.push({
          id: 1,
          status: KitchenUnitStatus.NOT_STARTED,
          startedAt: null,
          doneAt: null,
        });
        return 1;
      }),
    } as never);

    const result = await service.forceCompleteOrder(77, now);

    expect(tx.kitchenUnit.findMany).toHaveBeenCalledOnce();
    expect(units[0]).toEqual({
      id: 1,
      status: KitchenUnitStatus.DONE,
      startedAt: now,
      doneAt: now,
    });
    expect(result).toEqual({
      orderId: 77,
      completedUnits: 1,
      totalUnits: 1,
      kitchenReadyAt: now.toISOString(),
    });
  });

  it('rejects repeated/invalid transitions and non-confirmed orders', async () => {
    const alreadyStarted = makeWorkflow([unit(1, KitchenUnitStatus.STARTED)]);
    await expect(alreadyStarted.service.start(1, firstNow)).rejects.toBeInstanceOf(
      ConflictException,
    );

    const alreadyDone = makeWorkflow([unit(1, KitchenUnitStatus.DONE)]);
    await expect(alreadyDone.service.complete(1, firstNow)).rejects.toBeInstanceOf(
      ConflictException,
    );

    const placedOrder = makeWorkflow([unit(1)], OrderStatus.PLACED);
    await expect(placedOrder.service.start(1, firstNow)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});