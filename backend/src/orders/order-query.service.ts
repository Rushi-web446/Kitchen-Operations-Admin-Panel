import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { DeliveryDropStatus, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { formatCalendarDate, formatDatabaseTime, toDatabaseDate, toDatabaseTime } from './calendar-time';
import { ListOrdersDto } from './dto/list-orders.dto';
import { ORDER_RESPONSE_SELECT, toOrderResponse } from './order-response';
import { UpdateConfirmedOrderDto } from './dto/update-confirmed-order.dto';
import { OrderPlanningService } from './order-planning.service';

@Injectable()
export class OrderQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planning: OrderPlanningService,
  ) {}

  async list(query: ListOrdersDto) {
    if (query.deliveryDateFrom && query.deliveryDateTo && query.deliveryDateFrom > query.deliveryDateTo) {
      throw new BadRequestException('Delivery date from must be on or before delivery date to');
    }
    const orders = await this.prisma.order.findMany({
      where: {
        ...(query.companyId !== undefined ? { companyId: query.companyId } : {}),
        ...(query.employeeId !== undefined ? { employeeId: query.employeeId } : {}),
        ...(query.status !== undefined ? { status: query.status } : {}),
        ...(query.invoiced !== undefined ? { invoiceId: query.invoiced ? { not: null } : null } : {}),
        ...(query.deliveryDateFrom || query.deliveryDateTo ? {
          deliveryDate: {
            ...(query.deliveryDateFrom ? { gte: toDatabaseDate(query.deliveryDateFrom) } : {}),
            ...(query.deliveryDateTo ? { lte: toDatabaseDate(query.deliveryDateTo) } : {}),
          },
        } : {}),
        ...(query.search ? {
          OR: [
            { employee: { name: { contains: query.search.trim(), mode: 'insensitive' } } },
            { employee: { email: { contains: query.search.trim(), mode: 'insensitive' } } },
            { company: { name: { contains: query.search.trim(), mode: 'insensitive' } } },
            ...(Number.isInteger(Number(query.search)) && Number(query.search) > 0
              ? [{ id: Number(query.search) }]
              : []),
          ],
        } : {}),
      },
      select: ORDER_RESPONSE_SELECT,
      orderBy: [{ deliveryDate: 'asc' }, { deliveryTime: 'asc' }, { id: 'asc' }],
      take: query.limit,
      skip: query.offset,
    });

    return orders.map(toOrderResponse);
  }

  async getById(id: number) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: ORDER_RESPONSE_SELECT,
    });
    if (!order) {
      throw new NotFoundException('Order was not found');
    }
    return toOrderResponse(order);
  }

  async updateConfirmed(id: number, dto: UpdateConfirmedOrderDto, now = new Date()) {
    if (dto.deliveryTime === undefined && dto.deliveryAddressId === undefined && dto.packaging === undefined) {
      throw new BadRequestException('At least one order override must be provided');
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: number }>>`SELECT "id" FROM "Order" WHERE "id" = ${id} FOR UPDATE`;
      const order = await tx.order.findUnique({
        where: { id },
        select: {
          id: true, companyId: true, employeeId: true, status: true, invoiceId: true,
          deliveryDate: true, deliveryTime: true, deliveryAddressSnapshot: true,
          packaging: true, deliveryDropId: true,
          company: { select: { deliveryMinutes: true } },
          deliveryDrop: { select: { status: true } },
        },
      });
      if (!order) throw new NotFoundException('Order was not found');
      if (order.status !== OrderStatus.CONFIRMED) {
        throw new ConflictException('Only confirmed orders can be overridden');
      }
      if (order.invoiceId !== null) {
        throw new ConflictException('Invoiced orders are immutable; the invoice total will not be changed');
      }
      if (order.deliveryDrop?.status === DeliveryDropStatus.OUT_FOR_DELIVERY ||
          order.deliveryDrop?.status === DeliveryDropStatus.DELIVERED) {
        throw new ConflictException('An order cannot be changed after its drop is out for delivery');
      }
      let addressSnapshot: Prisma.InputJsonValue | undefined;
      if (dto.deliveryAddressId !== undefined) {
        const address = await tx.companyAddress.findFirst({
          where: { id: dto.deliveryAddressId, companyId: order.companyId },
          select: {
            recipientName: true, addressLine1: true, addressLine2: true, city: true,
            region: true, postalCode: true, country: true,
          },
        });
        if (!address) throw new BadRequestException('Delivery address does not belong to the order company');
        addressSnapshot = address;
      }
      const deliveryTime = dto.deliveryTime === undefined ? order.deliveryTime : toDatabaseTime(dto.deliveryTime);
      const planning = this.planning.calculate({
        deliveryDate: formatCalendarDate(order.deliveryDate),
        deliveryTime: formatDatabaseTime(deliveryTime),
        deliveryMinutes: order.company.deliveryMinutes,
      });
      const updated = await tx.order.update({
        where: { id },
        data: {
          ...(dto.deliveryTime !== undefined ? { deliveryTime } : {}),
          ...(addressSnapshot !== undefined ? { deliveryAddressSnapshot: addressSnapshot } : {}),
          ...(dto.packaging !== undefined ? { packaging: dto.packaging.trim() } : {}),
          plannedDispatchReadyAt: planning.plannedDispatchReadyAt,
          plannedKitchenReadyAt: planning.plannedKitchenReadyAt,
          ...(order.deliveryDropId !== null ? { deliveryDropId: null } : {}),
          updatedAt: now,
        },
        select: ORDER_RESPONSE_SELECT,
      });
      if (order.deliveryDropId !== null) {
        const emptyDrop = await tx.deliveryDrop.findUnique({
          where: { id: order.deliveryDropId },
          select: { id: true, status: true, _count: { select: { orders: true } } },
        });
        if (emptyDrop && emptyDrop._count.orders === 0 && emptyDrop.status === DeliveryDropStatus.KITCHEN_READY) {
          await tx.deliveryDrop.delete({ where: { id: emptyDrop.id } });
        }
      }
      return toOrderResponse(updated);
    });
  }

  /** Retains the immutable order snapshot while recording a cancellation. */
  async cancel(id: number, now = new Date()) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: number }>>`SELECT "id" FROM "Order" WHERE "id" = ${id} FOR UPDATE`;
      const order = await tx.order.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          invoiceId: true,
          deliveryDropId: true,
          deliveryDrop: { select: { id: true, status: true } },
        },
      });
      if (!order) throw new NotFoundException('Order was not found');
      if (order.invoiceId !== null) {
        throw new ConflictException('Invoiced orders are immutable; issue an adjustment outside this workflow');
      }
      if (
        order.status !== OrderStatus.DRAFT &&
        order.status !== OrderStatus.PLACED &&
        order.status !== OrderStatus.CONFIRMED
      ) {
        throw new ConflictException('Only un-invoiced draft, placed, or confirmed orders can be cancelled');
      }
      if (
        order.deliveryDrop?.status === DeliveryDropStatus.OUT_FOR_DELIVERY ||
        order.deliveryDrop?.status === DeliveryDropStatus.DELIVERED
      ) {
        throw new ConflictException('An order cannot be cancelled after its delivery has started');
      }
      const updated = await tx.order.updateMany({
        where: { id, status: order.status },
        data: {
          status: OrderStatus.CANCELLED,
          deliveryDropId: null,
          updatedAt: now,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException('The order changed while it was being cancelled; refresh and try again');
      }
      await tx.orderStatusHistory.create({
        data: { orderId: id, status: OrderStatus.CANCELLED },
      });
      if (order.deliveryDropId !== null) {
        const emptyDrop = await tx.deliveryDrop.findUnique({
          where: { id: order.deliveryDropId },
          select: { id: true, status: true, _count: { select: { orders: true } } },
        });
        if (
          emptyDrop &&
          emptyDrop._count.orders === 0 &&
          (emptyDrop.status === DeliveryDropStatus.KITCHEN_READY ||
            emptyDrop.status === DeliveryDropStatus.DISPATCH_READY)
        ) {
          await tx.deliveryDrop.delete({ where: { id: emptyDrop.id } });
        }
      }
      return { id, status: OrderStatus.CANCELLED, cancelledAt: now.toISOString() };
    });
  }

  async reject(id: number, now = new Date()) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: number }>>`SELECT "id" FROM "Order" WHERE "id" = ${id} FOR UPDATE`;
      const order = await tx.order.findUnique({
        where: { id },
        select: { id: true, status: true, invoiceId: true },
      });
      if (!order) throw new NotFoundException('Order was not found');
      if (order.status !== OrderStatus.PLACED) {
        throw new ConflictException('Only placed orders can be rejected');
      }
      if (order.invoiceId !== null) {
        throw new ConflictException('Invoiced orders are immutable');
      }
      const updated = await tx.order.updateMany({
        where: { id, status: OrderStatus.PLACED },
        data: { status: OrderStatus.REJECTED, updatedAt: now },
      });
      if (updated.count !== 1) {
        throw new ConflictException('The order changed while it was being rejected; refresh and try again');
      }
      await tx.orderStatusHistory.create({ data: { orderId: id, status: OrderStatus.REJECTED } });
      return { id, status: OrderStatus.REJECTED, rejectedAt: now.toISOString() };
    });
  }
}
