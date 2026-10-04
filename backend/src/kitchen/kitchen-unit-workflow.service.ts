import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { KitchenUnitStatus, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { KitchenUnitProvisioningService } from './kitchen-unit-provisioning.service';

const KITCHEN_UNIT_RESULT = {
  id: true,
  orderCombinationId: true,
  kitchenStation: true,
  status: true,
  startedAt: true,
  doneAt: true,
  orderCombination: {
    select: {
      quantity: true,
      orderLine: {
        select: {
          orderId: true,
          dishNameSnapshot: true,
          dishSkuSnapshot: true,
          order: { select: { status: true } },
        },
      },
      options: {
        select: {
          optionId: true,
          optionNameSnapshot: true,
        },
        orderBy: { id: 'asc' },
      },
    },
  },
} satisfies Prisma.KitchenUnitSelect;

type KitchenUnitRecord = Prisma.KitchenUnitGetPayload<{
  select: typeof KITCHEN_UNIT_RESULT;
}>;

@Injectable()
export class KitchenUnitWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provisioning: KitchenUnitProvisioningService,
  ) {}

  forceCompleteOrder(orderId: number, now = new Date()) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: number }>>`
        SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE
      `;
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          status: true,
          kitchenStartedAt: true,
          kitchenReadyAt: true,
        },
      });
      if (!order) throw new NotFoundException('Order was not found');
      if (order.status !== OrderStatus.CONFIRMED) {
        throw new ConflictException('Only confirmed orders can be force-completed');
      }

      await this.provisioning.ensureForConfirmedOrder(tx, orderId);
      const currentUnits = await tx.kitchenUnit.findMany({
        where: { orderCombination: { orderLine: { orderId } } },
        select: { id: true, status: true, startedAt: true, doneAt: true },
      });
      if (currentUnits.length === 0) {
        throw new BadRequestException('The order has no kitchen prep units to complete');
      }

      for (const unit of currentUnits) {
        if (unit.status === KitchenUnitStatus.DONE) continue;
        await tx.kitchenUnit.updateMany({
          where: {
            id: unit.id,
            status: { in: [KitchenUnitStatus.NOT_STARTED, KitchenUnitStatus.STARTED] },
          },
          data: {
            status: KitchenUnitStatus.DONE,
            startedAt: unit.startedAt ?? now,
            doneAt: now,
          },
        });
      }

      const firstStartedAt = currentUnits
        .map((unit) => unit.startedAt)
        .filter((startedAt): startedAt is Date => startedAt !== null)
        .sort((left, right) => left.getTime() - right.getTime())[0] ?? now;
      await tx.order.update({
        where: { id: orderId },
        data: {
          kitchenStartedAt: order.kitchenStartedAt ?? firstStartedAt,
          kitchenReadyAt: order.kitchenReadyAt ?? now,
        },
      });

      return {
        orderId,
        completedUnits: currentUnits.length,
        totalUnits: currentUnits.length,
        kitchenReadyAt: (order.kitchenReadyAt ?? now).toISOString(),
      };
    });
  }

  start(unitId: number, now = new Date()) {
    return this.prisma.$transaction(async (tx) => {
      const orderId = await this.findOrderId(tx, unitId);
      await this.lockOrder(tx, orderId);
      const unit = await this.findUnit(tx, unitId);
      this.assertConfirmed(unit);

      if (unit.status !== KitchenUnitStatus.NOT_STARTED) {
        throw new ConflictException('Only a not-started kitchen unit can be started');
      }

      const updated = await tx.kitchenUnit.updateMany({
        where: { id: unitId, status: KitchenUnitStatus.NOT_STARTED },
        data: { status: KitchenUnitStatus.STARTED, startedAt: now },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Kitchen unit state changed; reload and retry');
      }

      await tx.order.updateMany({
        where: { id: orderId, kitchenStartedAt: null },
        data: { kitchenStartedAt: now },
      });

      return this.toUnitResponse(await this.findUnitOrThrow(tx, unitId));
    });
  }

  complete(unitId: number, now = new Date()) {
    return this.prisma.$transaction(async (tx) => {
      const orderId = await this.findOrderId(tx, unitId);
      await this.lockOrder(tx, orderId);
      const unit = await this.findUnit(tx, unitId);
      this.assertConfirmed(unit);

      if (unit.status === KitchenUnitStatus.DONE) {
        throw new ConflictException('Kitchen unit is already done');
      }

      const wasNotStarted = unit.status === KitchenUnitStatus.NOT_STARTED;
      const updateData: Prisma.KitchenUnitUpdateManyMutationInput = {
        status: KitchenUnitStatus.DONE,
        doneAt: now,
      };
      if (wasNotStarted) updateData.startedAt = now;

      const updated = await tx.kitchenUnit.updateMany({
        where: {
          id: unitId,
          status: {
            in: [KitchenUnitStatus.NOT_STARTED, KitchenUnitStatus.STARTED],
          },
        },
        data: updateData,
      });
      if (updated.count !== 1) {
        throw new ConflictException('Kitchen unit state changed; reload and retry');
      }

      if (wasNotStarted) {
        await tx.order.updateMany({
          where: { id: orderId, kitchenStartedAt: null },
          data: { kitchenStartedAt: now },
        });
      }

      const remainingUnits = await tx.kitchenUnit.count({
        where: {
          status: { not: KitchenUnitStatus.DONE },
          orderCombination: { orderLine: { orderId } },
        },
      });
      if (remainingUnits === 0) {
        await tx.order.updateMany({
          where: { id: orderId, kitchenReadyAt: null },
          data: { kitchenReadyAt: now },
        });
      }

      return this.toUnitResponse(await this.findUnitOrThrow(tx, unitId));
    });
  }

  private async findOrderId(
    tx: Prisma.TransactionClient,
    unitId: number,
  ): Promise<number> {
    const unit = await tx.kitchenUnit.findUnique({
      where: { id: unitId },
      select: {
        orderCombination: {
          select: { orderLine: { select: { orderId: true } } },
        },
      },
    });
    if (!unit) throw new NotFoundException('Kitchen unit was not found');
    return unit.orderCombination.orderLine.orderId;
  }

  private async lockOrder(tx: Prisma.TransactionClient, orderId: number) {
    await tx.$queryRaw<Array<{ id: number }>>`
      SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE
    `;
  }

  private findUnit(tx: Prisma.TransactionClient, unitId: number) {
    return tx.kitchenUnit.findUnique({
      where: { id: unitId },
      select: KITCHEN_UNIT_RESULT,
    });
  }

  private async findUnitOrThrow(
    tx: Prisma.TransactionClient,
    unitId: number,
  ): Promise<KitchenUnitRecord> {
    const unit = await this.findUnit(tx, unitId);
    if (!unit) throw new NotFoundException('Kitchen unit was not found');
    return unit;
  }

  private assertConfirmed(unit: KitchenUnitRecord | null): asserts unit is KitchenUnitRecord {
    if (!unit) throw new NotFoundException('Kitchen unit was not found');
    if (unit.orderCombination.orderLine.order.status !== OrderStatus.CONFIRMED) {
      throw new ConflictException('Only confirmed orders can be worked on by Kitchen');
    }
  }

  private toUnitResponse(unit: KitchenUnitRecord) {
    return {
      id: unit.id,
      orderId: unit.orderCombination.orderLine.orderId,
      orderCombinationId: unit.orderCombinationId,
      dishName: unit.orderCombination.orderLine.dishNameSnapshot,
      dishSku: unit.orderCombination.orderLine.dishSkuSnapshot,
      quantity: unit.orderCombination.quantity,
      station: unit.kitchenStation,
      status: unit.status,
      startedAt: unit.startedAt?.toISOString() ?? null,
      doneAt: unit.doneAt?.toISOString() ?? null,
      selectedOptions: unit.orderCombination.options.map((option) => ({
        id: option.optionId,
        name: option.optionNameSnapshot,
      })),
    };
  }
}