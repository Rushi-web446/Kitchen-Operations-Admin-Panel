import { Injectable } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { KitchenUnitProvisioningService } from '../kitchen/kitchen-unit-provisioning.service';
import { toDatabaseDate } from './calendar-time';

@Injectable()
export class CutoffProcessorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kitchenUnitProvisioning: KitchenUnitProvisioningService,
  ) {}

  async process(deliveryDate?: string, now = new Date()) {
    const candidates = await this.prisma.$transaction(async (tx) => {
      const orders = await tx.order.findMany({
        where: {
          status: { in: [OrderStatus.DRAFT, OrderStatus.PLACED] },
          cutoffAt: { lte: now },
          ...(deliveryDate ? { deliveryDate: toDatabaseDate(deliveryDate) } : {}),
        },
        select: { id: true, status: true },
        orderBy: { id: 'asc' },
      });

      let cancelledDrafts = 0;
      let confirmedOrders = 0;

      for (const order of orders) {
        const nextStatus =
          order.status === OrderStatus.DRAFT
            ? OrderStatus.CANCELLED
            : OrderStatus.CONFIRMED;
        const updated = await tx.order.updateMany({
          where: { id: order.id, status: order.status },
          data: { status: nextStatus },
        });

        if (updated.count !== 1) {
          continue;
        }

        await tx.orderStatusHistory.create({
          data: { orderId: order.id, status: nextStatus },
        });
        if (nextStatus === OrderStatus.CONFIRMED) {
          await this.kitchenUnitProvisioning.ensureForConfirmedOrder(tx, order.id);
        }
        if (nextStatus === OrderStatus.CANCELLED) {
          cancelledDrafts += 1;
        } else {
          confirmedOrders += 1;
        }
      }

      return { cancelledDrafts, confirmedOrders };
    });

    return {
      processedAt: now.toISOString(),
      ...candidates,
    };
  }
}