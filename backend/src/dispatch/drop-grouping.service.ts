import {
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { DeliveryDropStatus, OrderStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  formatCalendarDate,
  formatDatabaseTime,
  toDatabaseDate,
} from '../orders/calendar-time';
import {
  advisoryLockId,
  canonicalizeDeliveryAddress,
  deliveryGroupKey,
} from './delivery-address.util';

interface ReadyOrder {
  id: number;
  companyId: number;
  deliveryDate: Date;
  deliveryTime: Date;
  deliveryAddressSnapshot: unknown;
  company: {
    defaultDriverId: number | null;
    defaultDriver: { id: number; companyId: number } | null;
  };
}

interface DropGroup {
  companyId: number;
  deliveryDate: Date;
  deliveryDateText: string;
  deliveryTime: Date;
  deliveryTimeText: string;
  addressKey: string;
  addressSnapshot: ReadyOrder['deliveryAddressSnapshot'];
  defaultDriverId: number | null;
  orderIds: number[];
}

@Injectable()
export class DropGroupingService {
  constructor(private readonly prisma: PrismaService) {}

  async groupReadyOrders(deliveryDate?: string) {
    const eligibleOrders = await this.prisma.order.findMany({
      where: {
        deliveryDropId: null,
        kitchenReadyAt: { not: null },
        status: OrderStatus.CONFIRMED,
        ...(deliveryDate ? { deliveryDate: toDatabaseDate(deliveryDate) } : {}),
      },
      select: {
        id: true,
        companyId: true,
        deliveryDate: true,
        deliveryTime: true,
        deliveryAddressSnapshot: true,
        company: {
          select: {
            defaultDriverId: true,
            defaultDriver: { select: { id: true, companyId: true } },
          },
        },
      },
      orderBy: [{ companyId: 'asc' }, { deliveryDate: 'asc' }, { deliveryTime: 'asc' }, { id: 'asc' }],
    });

    const groups = this.groupOrders(eligibleOrders as ReadyOrder[]);
    const createdOrReused: Array<{ dropId: number; orderCount: number }> = [];

    for (const group of groups) {
      const result = await this.persistGroup(group);
      if (result) createdOrReused.push(result);
    }

    return {
      dropCount: createdOrReused.length,
      drops: createdOrReused,
    };
  }

  private groupOrders(orders: ReadyOrder[]): DropGroup[] {
    const groups = new Map<string, DropGroup>();
    for (const order of orders) {
      const address = canonicalizeDeliveryAddress(order.deliveryAddressSnapshot as never);
      const deliveryDateText = formatCalendarDate(order.deliveryDate);
      const deliveryTimeText = this.formatExactTime(order.deliveryTime);
      const key = deliveryGroupKey({
        companyId: order.companyId,
        deliveryDate: deliveryDateText,
        deliveryAddressKey: address.key,
        deliveryTime: deliveryTimeText,
      });
      const group = groups.get(key);

      if (group) {
        group.orderIds.push(order.id);
        continue;
      }

      groups.set(key, {
        companyId: order.companyId,
        deliveryDate: order.deliveryDate,
        deliveryDateText,
        deliveryTime: order.deliveryTime,
        deliveryTimeText,
        addressKey: address.key,
        addressSnapshot: address.snapshot,
        defaultDriverId: order.company.defaultDriverId,
        orderIds: [order.id],
      });
    }
    return [...groups.values()];
  }

  private async persistGroup(group: DropGroup) {
    const lockKey = deliveryGroupKey({
      companyId: group.companyId,
      deliveryDate: group.deliveryDateText,
      deliveryAddressKey: group.addressKey,
      deliveryTime: group.deliveryTimeText,
    });
    const lockId = advisoryLockId(lockKey);

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ locked: boolean }>>`
        SELECT pg_advisory_xact_lock(${lockId}) IS NULL AS locked
      `;

      const candidates = await tx.order.findMany({
        where: {
          companyId: group.companyId,
          deliveryDate: group.deliveryDate,
          deliveryTime: group.deliveryTime,
          deliveryDropId: null,
          kitchenReadyAt: { not: null },
          status: OrderStatus.CONFIRMED,
        },
        select: { id: true, deliveryAddressSnapshot: true },
      });
      const matchingOrderIds = candidates
        .filter(
          (order) =>
            canonicalizeDeliveryAddress(order.deliveryAddressSnapshot).key === group.addressKey,
        )
        .map((order) => order.id);
      if (matchingOrderIds.length === 0) return null;

      if (
        group.defaultDriverId !== null &&
        group.defaultDriverId !== undefined
      ) {
        const defaultDriver = await tx.driver.findUnique({
          where: { id: group.defaultDriverId },
          select: { companyId: true },
        });
        if (!defaultDriver || defaultDriver.companyId !== group.companyId) {
          throw new ConflictException('Company default driver must belong to the same company');
        }
      }

      const drop = await tx.deliveryDrop.upsert({
        where: {
          companyId_deliveryDate_deliveryAddressKey_deliveryTime: {
            companyId: group.companyId,
            deliveryDate: group.deliveryDate,
            deliveryAddressKey: group.addressKey,
            deliveryTime: group.deliveryTime,
          },
        },
        update: {},
        create: {
          companyId: group.companyId,
          deliveryDate: group.deliveryDate,
          deliveryAddressKey: group.addressKey,
          deliveryAddressSnapshot: group.addressSnapshot as never,
          deliveryTime: group.deliveryTime,
          driverId: group.defaultDriverId,
          status: DeliveryDropStatus.KITCHEN_READY,
        },
        select: { id: true, status: true },
      });

      if (
        drop.status === DeliveryDropStatus.OUT_FOR_DELIVERY ||
        drop.status === DeliveryDropStatus.DELIVERED
      ) {
        throw new ConflictException('This delivery group has already started or completed');
      }

      const linked = await tx.order.updateMany({
        where: {
          id: { in: matchingOrderIds },
          deliveryDropId: null,
          kitchenReadyAt: { not: null },
          status: OrderStatus.CONFIRMED,
        },
        data: { deliveryDropId: drop.id },
      });

      return linked.count > 0
        ? { dropId: drop.id, orderCount: linked.count }
        : null;
    });
  }

  private formatExactTime(time: Date): string {
    return time.toISOString().slice(11, 23);
  }
}