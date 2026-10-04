import { Injectable } from '@nestjs/common';
import { DeliveryDropStatus, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { formatCalendarDate, formatDatabaseTime, IST_OFFSET_MINUTES, toDatabaseDate } from '../orders/calendar-time';
import { DispatchDropQueryDto } from './dto/dispatch-drop-query.dto';
import { DispatchDropDto } from './dto/dispatch-drop.dto';

const DROP_BOARD_INCLUDE = {
  company: {
    select: {
      id: true,
      name: true,
      defaultDriver: {
        select: { id: true, user: { select: { name: true, email: true } } },
      },
    },
  },
  driver: {
    select: { id: true, user: { select: { name: true, email: true } } },
  },
  orders: {
    orderBy: { id: 'asc' },
    select: {
      id: true,
      status: true,
      kitchenReadyAt: true,
      totalAmount: true,
      employee: { select: { id: true, name: true, email: true } },
    },
  },
} satisfies Prisma.DeliveryDropInclude;

@Injectable()
export class DispatchBoardService {
  constructor(private readonly prisma: PrismaService) {}

  async listDrivers(companyId?: number) {
    const localToday = formatCalendarDate(new Date(Date.now() + IST_OFFSET_MINUTES * 60_000));
    const drivers = await this.prisma.driver.findMany({
      where: companyId ? { companyId } : {},
      select: {
        id: true,
        companyId: true,
        user: { select: { name: true, email: true } },
        drops: {
          where: {
            status: { not: DeliveryDropStatus.DELIVERED },
            deliveryDate: { gte: toDatabaseDate(localToday) },
          },
          select: { id: true, deliveryDate: true, status: true },
        },
      },
      orderBy: { user: { name: 'asc' } },
    });
    return drivers.map((driver) => ({
      id: driver.id,
      companyId: driver.companyId,
      name: driver.user.name,
      email: driver.user.email,
      activeDropCount: driver.drops.length,
    }));
  }

  async list(query: DispatchDropQueryDto): Promise<DispatchDropDto[]> {
    const drops = await this.prisma.deliveryDrop.findMany({
      where: {
        ...(query.deliveryDate ? { deliveryDate: toDatabaseDate(query.deliveryDate) } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.companyId ? { companyId: query.companyId } : {}),
        ...(query.driverId ? { driverId: query.driverId } : {}),
      },
      include: DROP_BOARD_INCLUDE,
      orderBy: [{ deliveryDate: 'asc' }, { deliveryTime: 'asc' }, { id: 'asc' }],
    });

    return drops.map((drop) => {
      const allOrdersKitchenReady =
        drop.orders.length > 0 &&
        drop.orders.every(
          (order) => order.kitchenReadyAt !== null && order.status === OrderStatus.CONFIRMED,
        );

      return {
        id: drop.id,
        company: { id: drop.company.id, name: drop.company.name },
        deliveryDate: formatCalendarDate(drop.deliveryDate),
        deliveryTime: formatDatabaseTime(drop.deliveryTime),
        deliveryAddressSnapshot: drop.deliveryAddressSnapshot,
        status: drop.status,
        orderCount: drop.orders.length,
        orders: drop.orders.map((order) => ({
          id: order.id,
          status: order.status,
          kitchenReadyAt: order.kitchenReadyAt?.toISOString() ?? null,
          employee: order.employee,
          totalAmount: order.totalAmount.toFixed(2),
        })),
        driver: drop.driver
          ? { id: drop.driver.id, name: drop.driver.user.name, email: drop.driver.user.email }
          : null,
        defaultDriver: drop.company.defaultDriver
          ? {
              id: drop.company.defaultDriver.id,
              name: drop.company.defaultDriver.user.name,
              email: drop.company.defaultDriver.user.email,
            }
          : null,
        allOrdersKitchenReady,
        canGoOutForDelivery:
          drop.status === DeliveryDropStatus.DISPATCH_READY &&
          drop.driverId !== null &&
          allOrdersKitchenReady,
        isOutForDelivery: drop.status === DeliveryDropStatus.OUT_FOR_DELIVERY,
        isDelivered: drop.status === DeliveryDropStatus.DELIVERED,
        outForDeliveryAt: drop.outForDeliveryAt?.toISOString() ?? null,
        deliveredAt: drop.deliveredAt?.toISOString() ?? null,
        onTime: drop.deliveredOnTime,
        deliveryNote: drop.deliveryNote,
        deliveryPhotoUrl: drop.deliveryPhotoUrl,
      };
    });
  }
}