import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DeliveryDropStatus, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  formatCalendarDate,
  formatDatabaseTime,
  IST_OFFSET_MINUTES,
  toIstDateTime,
} from '../orders/calendar-time';
import { DeliverDropDto } from './dto/deliver-drop.dto';
import { DriverDropDetailDto } from './dto/driver-drop-detail.dto';

@Injectable()
export class DriverDropService {
  constructor(private readonly prisma: PrismaService) {}

  async listToday(driverId: number, now = new Date()) {
    const localToday = formatCalendarDate(
      new Date(now.getTime() + IST_OFFSET_MINUTES * 60_000),
    );
    const drops = await this.prisma.deliveryDrop.findMany({
      where: {
        driverId,
        deliveryDate: new Date(`${localToday}T00:00:00.000Z`),
        status: {
          in: [
            DeliveryDropStatus.KITCHEN_READY,
            DeliveryDropStatus.DISPATCH_READY,
            DeliveryDropStatus.OUT_FOR_DELIVERY,
            DeliveryDropStatus.DELIVERED,
          ],
        },
      },
      select: {
        id: true,
        deliveryDate: true,
        deliveryTime: true,
        deliveryAddressSnapshot: true,
        status: true,
        company: { select: { id: true, name: true } },
        orders: {
          orderBy: { id: 'asc' },
          select: { id: true, employee: { select: { name: true, email: true } } },
        },
      },
      orderBy: [{ deliveryTime: 'asc' }, { id: 'asc' }],
    });

    return drops.map((drop) => ({
      id: drop.id,
      deliveryDate: formatCalendarDate(drop.deliveryDate),
      deliveryTime: formatDatabaseTime(drop.deliveryTime),
      deliveryAddressSnapshot: drop.deliveryAddressSnapshot,
      status: drop.status,
      company: drop.company,
      orderCount: drop.orders.length,
      orders: drop.orders.map((order) => ({
        id: order.id,
        employeeName: order.employee.name,
        employeeEmail: order.employee.email,
      })),
    }));
  }

  async getDrop(driverId: number, dropId: number): Promise<DriverDropDetailDto> {
    const drop = await this.prisma.deliveryDrop.findUnique({
      where: { id: dropId },
      select: {
        id: true,
        driverId: true,
        company: { select: { id: true, name: true } },
        driver: { select: { id: true, user: { select: { name: true, email: true } } } },
        deliveryDate: true,
        deliveryTime: true,
        deliveryAddressSnapshot: true,
        status: true,
        outForDeliveryAt: true,
        deliveredAt: true,
        deliveredOnTime: true,
        deliveryNote: true,
        deliveryPhotoUrl: true,
        orders: {
          orderBy: { id: 'asc' },
          select: {
            id: true,
            status: true,
            totalAmount: true,
            packaging: true,
            driverInstructionsSnapshot: true,
            employee: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!drop) {
      throw new NotFoundException('Delivery drop was not found');
    }
    if (drop.driverId !== driverId) {
      throw new ForbiddenException('This delivery drop is assigned to another driver');
    }

    return {
      id: drop.id,
      company: { id: drop.company.id, name: drop.company.name },
      deliveryDate: formatCalendarDate(drop.deliveryDate),
      deliveryTime: formatDatabaseTime(drop.deliveryTime),
      deliveryAddressSnapshot: drop.deliveryAddressSnapshot,
      driverInstructions: drop.orders.find((order) => order.driverInstructionsSnapshot)?.driverInstructionsSnapshot ?? null,
      status: drop.status,
      orderCount: drop.orders.length,
      orders: drop.orders.map((order) => {
        const totalAmount =
          order.totalAmount instanceof Prisma.Decimal
            ? order.totalAmount.toFixed(2)
            : Number(order.totalAmount).toFixed(2);

        return {
          id: order.id,
          status: order.status,
          employee: order.employee,
          totalAmount,
          packaging: order.packaging,
        };
      }),
      driver: drop.driver
        ? { id: drop.driver.id, name: drop.driver.user.name, email: drop.driver.user.email }
        : null,
      outForDeliveryAt: drop.outForDeliveryAt?.toISOString() ?? null,
      deliveredAt: drop.deliveredAt?.toISOString() ?? null,
      onTime: drop.deliveredOnTime ?? null,
      deliveryNote: drop.deliveryNote,
      deliveryPhotoUrl: drop.deliveryPhotoUrl,
    };
  }

  async deliver(driverId: number, dropId: number, dto: DeliverDropDto, now = new Date()) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: number }>>`
        SELECT "id" FROM "DeliveryDrop" WHERE "id" = ${dropId} FOR UPDATE
      `;

      const drop = await tx.deliveryDrop.findUnique({
        where: { id: dropId },
        select: {
          id: true,
          companyId: true,
          driverId: true,
          status: true,
          deliveryDate: true,
          deliveryTime: true,
          orders: { select: { id: true, status: true } },
        },
      });
      if (!drop) throw new NotFoundException('Delivery drop was not found');
      if (drop.driverId !== driverId) {
        throw new ForbiddenException('This delivery drop is assigned to another driver');
      }
      if (drop.status !== DeliveryDropStatus.OUT_FOR_DELIVERY) {
        throw new ConflictException('Only out-for-delivery drops can be marked delivered');
      }
      if (drop.orders.length === 0 || drop.orders.some((order) => order.status !== OrderStatus.CONFIRMED)) {
        throw new ConflictException('Drop orders are not in a deliverable state');
      }

      const scheduledAt = toIstDateTime(
        formatCalendarDate(drop.deliveryDate),
        formatDatabaseTime(drop.deliveryTime),
      );
      const deliveredOnTime = now.getTime() <= scheduledAt.getTime();
      const updated = await tx.deliveryDrop.updateMany({
        where: {
          id: dropId,
          driverId,
          status: DeliveryDropStatus.OUT_FOR_DELIVERY,
        },
        data: {
          status: DeliveryDropStatus.DELIVERED,
          deliveredAt: now,
          deliveredOnTime,
          deliveryNote: dto.note ?? null,
          deliveryPhotoUrl: dto.photoUrl ?? null,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Drop state changed; reload and retry');
      }

      const orderIds = drop.orders.map((order) => order.id);
      const ordersUpdated = await tx.order.updateMany({
        where: { id: { in: orderIds }, status: OrderStatus.CONFIRMED },
        data: { status: OrderStatus.DELIVERED, deliveredAt: now },
      });
      if (ordersUpdated.count !== orderIds.length) {
        throw new ConflictException('Not every order in this drop could be delivered');
      }
      await tx.orderStatusHistory.createMany({
        data: orderIds.map((orderId) => ({ orderId, status: OrderStatus.DELIVERED })),
      });

      return {
        id: drop.id,
        status: DeliveryDropStatus.DELIVERED,
        deliveredAt: now.toISOString(),
        onTime: deliveredOnTime,
        deliveryNote: dto.note ?? null,
        deliveryPhotoUrl: dto.photoUrl ?? null,
        deliveredOrderIds: orderIds,
      };
    });
  }
}