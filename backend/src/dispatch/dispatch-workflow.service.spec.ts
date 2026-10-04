import { ConflictException, ForbiddenException } from '@nestjs/common';
import { DeliveryDropStatus, OrderStatus, Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../database/prisma.service';
import { DispatchWorkflowService } from './dispatch-workflow.service';

function makeWorkflow(status: DeliveryDropStatus, driverId: number | null = 5) {
  const state = {
    id: 11,
    companyId: 2,
    driverId,
    status,
    orders: [
      {
        id: 31,
        status: OrderStatus.CONFIRMED,
        kitchenReadyAt: new Date('2026-10-04T05:00:00.000Z'),
      },
    ],
  };
  const drivers = new Map([
    [5, { id: 5, companyId: 2 }],
    [6, { id: 6, companyId: 3 }],
  ]);
  const tx = {
    $queryRaw: vi.fn(async () => [{ id: state.id }]),
    deliveryDrop: {
      findUnique: vi.fn(async () => ({ ...state, orders: [...state.orders] })),
      updateMany: vi.fn(async ({ where, data }: {
        where: { status: DeliveryDropStatus | { in: DeliveryDropStatus[] }; driverId?: { not: null } };
        data: Partial<typeof state> & { outForDeliveryAt?: Date };
      }) => {
        const matchesStatus =
          typeof where.status === 'string'
            ? state.status === where.status
            : where.status.in.includes(state.status);
        if (!matchesStatus || (where.driverId?.not === null && state.driverId === null)) {
          return { count: 0 };
        }
        Object.assign(state, data);
        return { count: 1 };
      }),
      findUniqueOrThrow: vi.fn(async () => ({ id: state.id, status: state.status, updatedAt: new Date() })),
    },
    driver: {
      findUnique: vi.fn(async ({ where }: { where: { id: number } }) => drivers.get(where.id) ?? null),
    },
    order: {
      updateMany: vi.fn(async () => ({ count: state.orders.length })),
    },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (client: Prisma.TransactionClient) => Promise<unknown>) =>
      callback(tx as unknown as Prisma.TransactionClient),
    ),
  } as unknown as PrismaService;

  return { service: new DispatchWorkflowService(prisma), state, tx };
}

describe('DispatchWorkflowService', () => {
  it('allows only KITCHEN_READY to DISPATCH_READY and rejects repeats/skips', async () => {
    const ready = makeWorkflow(DeliveryDropStatus.KITCHEN_READY);
    await ready.service.markDispatchReady(11);
    expect(ready.state.status).toBe(DeliveryDropStatus.DISPATCH_READY);

    await expect(ready.service.markDispatchReady(11)).rejects.toBeInstanceOf(ConflictException);
    const kitchen = makeWorkflow(DeliveryDropStatus.KITCHEN_READY);
    await expect(kitchen.service.startDelivery(11)).rejects.toBeInstanceOf(ConflictException);
  });

  it('validates driver company and requires driver before out-for-delivery', async () => {
    const noDriver = makeWorkflow(DeliveryDropStatus.DISPATCH_READY, null);
    await expect(noDriver.service.startDelivery(11)).rejects.toThrow('Assign a driver');

    const wrongCompany = makeWorkflow(DeliveryDropStatus.DISPATCH_READY);
    await expect(
      wrongCompany.service.assignDriver(11, { driverId: 6 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows assignment, starts delivery and updates associated orders atomically', async () => {
    const workflow = makeWorkflow(DeliveryDropStatus.KITCHEN_READY);
    await workflow.service.assignDriver(11, { driverId: 5 });
    await workflow.service.markDispatchReady(11);
    const result = await workflow.service.startDelivery(11, new Date('2026-10-04T06:00:00.000Z'));

    expect(result.status).toBe(DeliveryDropStatus.OUT_FOR_DELIVERY);
    expect(workflow.state.outForDeliveryAt).toEqual(new Date('2026-10-04T06:00:00.000Z'));
    expect(workflow.tx.order.updateMany).toHaveBeenCalledOnce();
  });
});