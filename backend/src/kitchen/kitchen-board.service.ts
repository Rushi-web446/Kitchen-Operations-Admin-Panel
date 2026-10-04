import { Injectable } from '@nestjs/common';
import {
  KitchenUnitStatus,
  OrderStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { formatCalendarDate, formatDatabaseTime, toDatabaseDate } from '../orders/calendar-time';
import { KitchenBoardQueryDto } from './dto/kitchen-board-query.dto';
import { KitchenOrderBoardItem } from './dto/kitchen-board.dto';

const KITCHEN_ORDER_INCLUDE = {
  employee: { select: { id: true, name: true, email: true } },
  company: { select: { id: true, name: true } },
  lines: {
    select: {
      dishNameSnapshot: true,
      dishSkuSnapshot: true,
      combinations: {
        select: {
          id: true,
          quantity: true,
          options: {
            select: { optionId: true, optionNameSnapshot: true },
            orderBy: { id: 'asc' },
          },
          kitchenUnits: {
            select: {
              id: true,
              orderCombinationId: true,
              kitchenStation: true,
              status: true,
              startedAt: true,
              doneAt: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.OrderInclude;

@Injectable()
export class KitchenBoardService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: KitchenBoardQueryDto, now = new Date()): Promise<KitchenOrderBoardItem[]> {
    const unitFilter: Prisma.KitchenUnitWhereInput = {
      ...(query.kitchenStation ? { kitchenStation: query.kitchenStation } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const orders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.CONFIRMED,
        ...(query.deliveryDate
          ? { deliveryDate: toDatabaseDate(query.deliveryDate) }
          : {}),
        lines: {
          some: {
            combinations: {
              some: { kitchenUnits: { some: unitFilter } },
            },
          },
        },
      },
      include: KITCHEN_ORDER_INCLUDE,
      orderBy: [{ plannedKitchenReadyAt: 'asc' }, { id: 'asc' }],
    });

    return orders.map((order) => {
      const allUnits = order.lines.flatMap((line) =>
        line.combinations.flatMap((combination) =>
          combination.kitchenUnits.map((unit) => ({
            id: unit.id,
            orderCombinationId: unit.orderCombinationId,
            dishName: line.dishNameSnapshot,
            dishSku: line.dishSkuSnapshot,
            quantity: combination.quantity,
            station: unit.kitchenStation,
            status: unit.status,
            startedAt: unit.startedAt?.toISOString() ?? null,
            doneAt: unit.doneAt?.toISOString() ?? null,
            selectedOptions: combination.options.map((option) => ({
              id: option.optionId,
              name: option.optionNameSnapshot,
            })),
          })),
        ),
      );
      const units = allUnits.filter(
        (unit) =>
          (!query.kitchenStation || unit.station === query.kitchenStation) &&
          (!query.status || unit.status === query.status),
      );
      const completedUnits = allUnits.filter(
        (unit) => unit.status === KitchenUnitStatus.DONE,
      ).length;

      return {
        id: order.id,
        deliveryDate: formatCalendarDate(order.deliveryDate),
        deliveryTime: formatDatabaseTime(order.deliveryTime),
        plannedKitchenReadyAt: order.plannedKitchenReadyAt?.toISOString() ?? null,
        kitchenStartedAt: order.kitchenStartedAt?.toISOString() ?? null,
        kitchenReadyAt: order.kitchenReadyAt?.toISOString() ?? null,
        employee: order.employee,
        company: order.company,
        units,
        progress: { completedUnits, totalUnits: allUnits.length },
        isAtRisk:
          order.plannedKitchenReadyAt !== null &&
          order.plannedKitchenReadyAt.getTime() < now.getTime() &&
          order.kitchenReadyAt === null,
      };
    });
  }
}