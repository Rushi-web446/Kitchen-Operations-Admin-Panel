import { Injectable } from '@nestjs/common';
import { DeliveryDropStatus, KitchenUnitStatus, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { formatCalendarDate, IST_OFFSET_MINUTES, toDatabaseDate } from '../orders/calendar-time';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(deliveryDate?: string, now = new Date()) {
    const date = deliveryDate ?? formatCalendarDate(new Date(now.getTime() + IST_OFFSET_MINUTES * 60_000));
    const databaseDate = toDatabaseDate(date);
    const confirmedForDate = { status: OrderStatus.CONFIRMED, deliveryDate: databaseDate };
    const kitchenUnitsForDate: Prisma.KitchenUnitWhereInput = {
      orderCombination: { orderLine: { order: confirmedForDate } },
    };
    const atRiskWhere: Prisma.OrderWhereInput = {
      ...confirmedForDate,
      plannedKitchenReadyAt: { lt: now },
      kitchenReadyAt: null,
    };

    const [
      confirmedOrders, atRiskOrders, totalUnits, startedUnits, doneUnits,
      drops, unassignedDrops, outForDeliveryDrops, deliveredDrops, lateDrops,
      uninvoicedOrders, uninvoicedAmount, activeDishes, activeCategories,
    ] = await this.prisma.$transaction([
      this.prisma.order.count({ where: confirmedForDate }),
      this.prisma.order.count({ where: atRiskWhere }),
      this.prisma.kitchenUnit.count({ where: kitchenUnitsForDate }),
      this.prisma.kitchenUnit.count({ where: { ...kitchenUnitsForDate, status: KitchenUnitStatus.STARTED } }),
      this.prisma.kitchenUnit.count({ where: { ...kitchenUnitsForDate, status: KitchenUnitStatus.DONE } }),
      this.prisma.deliveryDrop.count({ where: { deliveryDate: databaseDate } }),
      this.prisma.deliveryDrop.count({ where: { deliveryDate: databaseDate, driverId: null } }),
      this.prisma.deliveryDrop.count({ where: { deliveryDate: databaseDate, status: DeliveryDropStatus.OUT_FOR_DELIVERY } }),
      this.prisma.deliveryDrop.count({ where: { deliveryDate: databaseDate, status: DeliveryDropStatus.DELIVERED } }),
      this.prisma.deliveryDrop.count({ where: { deliveryDate: databaseDate, status: DeliveryDropStatus.DELIVERED, deliveredOnTime: false } }),
      this.prisma.order.count({ where: { status: OrderStatus.CONFIRMED, invoiceId: null } }),
      this.prisma.order.aggregate({ where: { status: OrderStatus.CONFIRMED, invoiceId: null }, _sum: { totalAmount: true } }),
      this.prisma.dish.count({ where: { active: true } }),
      this.prisma.category.count({ where: { active: true } }),
    ]);

    return {
      deliveryDate: date,
      generatedAt: now.toISOString(),
      kitchen: { confirmedOrders, totalUnits, startedUnits, doneUnits, atRiskOrders },
      dispatch: { drops, unassignedDrops, outForDeliveryDrops, deliveredDrops, lateDrops },
      billing: {
        uninvoicedConfirmedOrders: uninvoicedOrders,
        uninvoicedConfirmedAmount: (uninvoicedAmount._sum.totalAmount ?? new Prisma.Decimal(0)).toFixed(2),
      },
      catalogue: { activeDishes, activeCategories },
    };
  }
}
