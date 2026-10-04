import { OrderStatus, Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../database/prisma.service';
import { CutoffProcessorService } from './cutoff-processor.service';

function makeProcessor(initial: Array<{ id: number; status: OrderStatus }>) {
  const state = new Map(initial.map((order) => [order.id, order.status]));
  const history: Array<{ orderId: number; status: OrderStatus }> = [];

  const tx = {
    order: {
      findMany: vi.fn(async () =>
        [...state]
          .filter(([, status]) => [OrderStatus.DRAFT, OrderStatus.PLACED].includes(status))
          .map(([id, status]) => ({ id, status })),
      ),
      updateMany: vi.fn(async ({
        where,
        data,
      }: {
        where: { id: number; status: OrderStatus };
        data: { status: OrderStatus };
      }) => {
        if (state.get(where.id) !== where.status) return { count: 0 };
        state.set(where.id, data.status);
        return { count: 1 };
      }),
    },
    orderStatusHistory: {
      create: vi.fn(async ({
        data,
      }: {
        data: { orderId: number; status: OrderStatus };
      }) => {
        history.push(data);
        return data;
      }),
    },
  };

  const prisma = {
    $transaction: vi.fn(
      async (callback: (client: Prisma.TransactionClient) => Promise<unknown>) =>
        callback(tx as unknown as Prisma.TransactionClient),
    ),
  } as unknown as PrismaService;
  const kitchenUnitProvisioning = {
    ensureForConfirmedOrder: vi.fn(async () => 1),
  };

  return {
    processor: new CutoffProcessorService(prisma, kitchenUnitProvisioning as never),
    state,
    history,
    tx,
    kitchenUnitProvisioning,
  };
}

describe('CutoffProcessorService', () => {
  const now = new Date('2026-10-06T00:00:00.000Z');

  it('cancels drafts and confirms placed orders, recording only actual transitions', async () => {
    const { processor, state, history, kitchenUnitProvisioning } = makeProcessor([
      { id: 1, status: OrderStatus.DRAFT },
      { id: 2, status: OrderStatus.PLACED },
      { id: 3, status: OrderStatus.CONFIRMED },
      { id: 4, status: OrderStatus.CANCELLED },
      { id: 5, status: OrderStatus.REJECTED },
      { id: 6, status: OrderStatus.DELIVERED },
    ]);

    const result = await processor.process(undefined, now);

    expect(state.get(1)).toBe(OrderStatus.CANCELLED);
    expect(state.get(2)).toBe(OrderStatus.CONFIRMED);
    expect(state.get(3)).toBe(OrderStatus.CONFIRMED);
    expect(state.get(4)).toBe(OrderStatus.CANCELLED);
    expect(state.get(5)).toBe(OrderStatus.REJECTED);
    expect(state.get(6)).toBe(OrderStatus.DELIVERED);
    expect(history).toEqual([
      { orderId: 1, status: OrderStatus.CANCELLED },
      { orderId: 2, status: OrderStatus.CONFIRMED },
    ]);
    expect(result).toMatchObject({ cancelledDrafts: 1, confirmedOrders: 1 });
    expect(kitchenUnitProvisioning.ensureForConfirmedOrder).toHaveBeenCalledOnce();
  });

  it('is idempotent and filters by an optional delivery date', async () => {
    const { processor, state, history, tx } = makeProcessor([
      { id: 1, status: OrderStatus.DRAFT },
      { id: 2, status: OrderStatus.PLACED },
    ]);

    await processor.process('2026-10-07', now);
    const secondRun = await processor.process('2026-10-07', now);

    expect(state.get(1)).toBe(OrderStatus.CANCELLED);
    expect(state.get(2)).toBe(OrderStatus.CONFIRMED);
    expect(history).toHaveLength(2);
    expect(secondRun).toMatchObject({ cancelledDrafts: 0, confirmedOrders: 0 });
    expect(tx.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deliveryDate: new Date('2026-10-07T00:00:00.000Z'),
        }),
      }),
    );
  });
});