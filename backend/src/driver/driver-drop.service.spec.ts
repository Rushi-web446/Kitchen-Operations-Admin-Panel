import { ForbiddenException, ConflictException } from '@nestjs/common';
import { DeliveryDropStatus, OrderStatus, Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../database/prisma.service';
import { DriverDropService } from './driver-drop.service';

function makeService(status = DeliveryDropStatus.OUT_FOR_DELIVERY, driverId = 8) {
  const drop = {
    id: 12,
    companyId: 4,
    driverId,
    status,
    deliveryDate: new Date('2026-10-04T00:00:00.000Z'),
    deliveryTime: new Date('1970-01-01T12:00:00.000Z'),
    orders: [{ id: 44, status: OrderStatus.CONFIRMED }],
  };
  const tx = {
    $queryRaw: vi.fn(async () => [{ id: drop.id }]),
    deliveryDrop: {
      findUnique: vi.fn(async () => ({ ...drop, orders: [...drop.orders] })),
      updateMany: vi.fn(async ({ where, data }: {
        where: { id: number; driverId: number; status: DeliveryDropStatus };
        data: Partial<typeof drop> & { deliveredAt: Date; deliveredOnTime: boolean; deliveryNote: string | null; deliveryPhotoUrl: string | null };
      }) => {
        if (where.driverId !== drop.driverId || where.status !== drop.status) return { count: 0 };
        Object.assign(drop, data);
        return { count: 1 };
      }),
    },
    order: { updateMany: vi.fn(async () => ({ count: drop.orders.length })) },
    orderStatusHistory: { createMany: vi.fn(async () => ({ count: drop.orders.length })) },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (client: Prisma.TransactionClient) => Promise<unknown>) =>
      callback(tx as unknown as Prisma.TransactionClient),
  ) } as unknown as PrismaService;
  return { service: new DriverDropService(prisma), drop, tx };
}

describe('DriverDropService', () => {
  it('queries only the authenticated driver and IST calendar day', async () => {
    const findMany = vi.fn(async () => []);
    const prisma = {
      deliveryDrop: { findMany },
    } as unknown as PrismaService;
    const service = new DriverDropService(prisma);
    const instant = new Date('2026-10-03T19:00:00.000Z');

    await service.listToday(88, instant);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          driverId: 88,
          deliveryDate: new Date('2026-10-04T00:00:00.000Z'),
          status: { in: [DeliveryDropStatus.KITCHEN_READY, DeliveryDropStatus.DISPATCH_READY, DeliveryDropStatus.OUT_FOR_DELIVERY, DeliveryDropStatus.DELIVERED] },
        }),
        orderBy: [{ deliveryTime: 'asc' }, { id: 'asc' }],
      }),
    );
  });

  it('returns a driver-owned drop detail and rejects other-driver access', async () => {
    const prisma = {
      deliveryDrop: {
        findUnique: vi.fn(async () => ({
          id: 12,
          driverId: 8,
          company: { id: 4, name: 'Acme' },
          driver: { id: 8, user: { name: 'Driver 8', email: 'driver8@example.com' } },
          deliveryDate: new Date('2026-10-04T00:00:00.000Z'),
          deliveryTime: new Date('1970-01-01T12:00:00.000Z'),
          deliveryAddressSnapshot: { city: 'Bengaluru' },
          status: DeliveryDropStatus.OUT_FOR_DELIVERY,
          outForDeliveryAt: new Date('2026-10-04T06:00:00.000Z'),
          deliveredAt: null,
          deliveredOnTime: null,
          deliveryNote: null,
          deliveryPhotoUrl: null,
          orders: [{ id: 44, status: OrderStatus.CONFIRMED, totalAmount: '120.00', packaging: 'Bag', employee: { id: 2, name: 'Asha', email: 'asha@example.com' } }],
        })),
      },
    } as unknown as PrismaService;
    const service = new DriverDropService(prisma);

    await expect(service.getDrop(8, 12)).resolves.toMatchObject({
      id: 12,
      company: { id: 4, name: 'Acme' },
      orderCount: 1,
      driver: { id: 8, name: 'Driver 8', email: 'driver8@example.com' },
    });
    await expect(service.getDrop(9, 12)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('marks a drop and its orders delivered and computes on-time using exact scheduled time', async () => {
    const { service, drop, tx } = makeService();
    const scheduledInstant = new Date('2026-10-04T06:30:00.000Z');
    const result = await service.deliver(
      8,
      12,
      { note: 'At reception', photoUrl: 'https://files.example/delivery.jpg' },
      scheduledInstant,
    );

    expect(result).toMatchObject({ status: DeliveryDropStatus.DELIVERED, onTime: true });
    expect(drop.deliveredAt).toEqual(scheduledInstant);
    expect(drop.deliveryNote).toBe('At reception');
    expect(drop.deliveryPhotoUrl).toBe('https://files.example/delivery.jpg');
    expect(tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: OrderStatus.DELIVERED, deliveredAt: scheduledInstant } }),
    );
    expect(tx.orderStatusHistory.createMany).toHaveBeenCalledOnce();
  });

  it('marks late delivery false with no grace period', async () => {
    const { service } = makeService();
    const result = await service.deliver(8, 12, {}, new Date('2026-10-04T06:30:00.001Z'));
    expect(result.onTime).toBe(false);
  });

  it('rejects another driver and duplicate/non-out-for-delivery completion', async () => {
    const { service } = makeService();
    await expect(service.deliver(9, 12, {})).rejects.toBeInstanceOf(ForbiddenException);

    const notOut = makeService(DeliveryDropStatus.DISPATCH_READY);
    await expect(notOut.service.deliver(8, 12, {})).rejects.toBeInstanceOf(ConflictException);
  });
});