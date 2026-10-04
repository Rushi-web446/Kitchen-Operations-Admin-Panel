import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DeliveryDropStatus, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AssignDriverDto } from './dto/assign-driver.dto';

const DROP_FOR_UPDATE = {
  id: true,
  companyId: true,
  driverId: true,
  status: true,
  orders: {
    select: { id: true, status: true, kitchenReadyAt: true },
  },
} satisfies Prisma.DeliveryDropSelect;

type DropRecord = Prisma.DeliveryDropGetPayload<{ select: typeof DROP_FOR_UPDATE }>;

@Injectable()
export class DispatchWorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  markDispatchReady(dropId: number, now = new Date()) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockDrop(tx, dropId);
      const drop = await this.findDrop(tx, dropId);
      if (drop.status !== DeliveryDropStatus.KITCHEN_READY) {
        throw new ConflictException('Only kitchen-ready drops can be marked dispatch-ready');
      }
      this.assertOrdersKitchenReady(drop);

      const updated = await tx.deliveryDrop.updateMany({
        where: { id: dropId, status: DeliveryDropStatus.KITCHEN_READY },
        data: { status: DeliveryDropStatus.DISPATCH_READY, updatedAt: now },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Drop state changed; reload and retry');
      }

      return tx.deliveryDrop.findUniqueOrThrow({
        where: { id: dropId },
        select: { id: true, status: true, updatedAt: true },
      });
    });
  }

  assignDriver(dropId: number, dto: AssignDriverDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockDrop(tx, dropId);
      const drop = await this.findDrop(tx, dropId);
      if (
        drop.status === DeliveryDropStatus.OUT_FOR_DELIVERY ||
        drop.status === DeliveryDropStatus.DELIVERED
      ) {
        throw new ConflictException('Driver cannot be changed after delivery starts');
      }

      const driver = await tx.driver.findUnique({
        where: { id: dto.driverId },
        select: { id: true, companyId: true },
      });
      if (!driver) throw new NotFoundException('Driver was not found');
      if (driver.companyId !== drop.companyId) {
        throw new ForbiddenException('Driver belongs to a different company');
      }

      const updated = await tx.deliveryDrop.updateMany({
        where: {
          id: dropId,
          status: { in: [DeliveryDropStatus.KITCHEN_READY, DeliveryDropStatus.DISPATCH_READY] },
        },
        data: { driverId: driver.id },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Drop state changed; reload and retry');
      }
      return { id: dropId, driverId: driver.id };
    });
  }

  startDelivery(dropId: number, now = new Date()) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockDrop(tx, dropId);
      const drop = await this.findDrop(tx, dropId);
      if (drop.status !== DeliveryDropStatus.DISPATCH_READY) {
        throw new ConflictException('Only dispatch-ready drops can go out for delivery');
      }
      if (drop.driverId === null) {
        throw new BadRequestException('Assign a driver before starting delivery');
      }
      this.assertOrdersKitchenReady(drop);

      const updated = await tx.deliveryDrop.updateMany({
        where: { id: dropId, status: DeliveryDropStatus.DISPATCH_READY, driverId: { not: null } },
        data: { status: DeliveryDropStatus.OUT_FOR_DELIVERY, outForDeliveryAt: now },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Drop state changed; reload and retry');
      }

      const orderIds = drop.orders.map((order) => order.id);
      const ordersUpdated = await tx.order.updateMany({
        where: { id: { in: orderIds }, status: OrderStatus.CONFIRMED, kitchenReadyAt: { not: null } },
        data: { outForDeliveryAt: now },
      });
      if (ordersUpdated.count !== orderIds.length) {
        throw new ConflictException('Drop contains orders that are no longer ready for delivery');
      }

      return { id: dropId, status: DeliveryDropStatus.OUT_FOR_DELIVERY, outForDeliveryAt: now.toISOString() };
    });
  }

  private async lockDrop(tx: Prisma.TransactionClient, dropId: number) {
    await tx.$queryRaw<Array<{ id: number }>>`
      SELECT "id" FROM "DeliveryDrop" WHERE "id" = ${dropId} FOR UPDATE
    `;
  }

  private async findDrop(tx: Prisma.TransactionClient, dropId: number): Promise<DropRecord> {
    const drop = await tx.deliveryDrop.findUnique({
      where: { id: dropId },
      select: DROP_FOR_UPDATE,
    });
    if (!drop) throw new NotFoundException('Delivery drop was not found');
    return drop;
  }

  private assertOrdersKitchenReady(drop: DropRecord) {
    if (
      drop.orders.length === 0 ||
      drop.orders.some(
        (order) =>
          order.status !== OrderStatus.CONFIRMED || order.kitchenReadyAt === null,
      )
    ) {
      throw new ConflictException('Every order in the drop must be confirmed and kitchen-ready');
    }
  }
}