import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { ListInvoicesDto } from './dto/list-invoices.dto';
import { addCalendarDays, assertCalendarDate, toIstDateTime } from '../orders/calendar-time';

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  async listUninvoicedOrders(companyId?: number) {
    const orders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.CONFIRMED,
        invoiceId: null,
        ...(companyId ? { companyId } : {}),
      },
      include: {
        company: { select: { id: true, name: true } },
        employee: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ companyId: 'asc' }, { id: 'asc' }],
    });

    return orders.map((order) => ({
      id: order.id,
      company: order.company,
      employee: order.employee,
      status: order.status,
      deliveryDate: order.deliveryDate.toISOString().slice(0, 10),
      deliveryTime: order.deliveryTime.toISOString().slice(11, 16),
      totalAmount: toFixed(order.totalAmount),
    }));
  }

  async listInvoices(query: ListInvoicesDto = {}) {
    this.assertInvoiceDateRange(query.issuedDateFrom, query.issuedDateTo, 'Issued');
    this.assertInvoiceDateRange(query.paidDateFrom, query.paidDateTo, 'Paid');
    const where: Prisma.InvoiceWhereInput = {
        ...(query.companyId ? { companyId: query.companyId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.issuedDateFrom || query.issuedDateTo ? {
          issuedAt: this.dateRange(query.issuedDateFrom, query.issuedDateTo),
        } : {}),
        ...(query.paidDateFrom || query.paidDateTo ? {
          paidAt: { not: null, ...this.dateRange(query.paidDateFrom, query.paidDateTo) },
        } : {}),
      };
    const [invoices, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
      where,
      include: {
        company: { select: { id: true, name: true } },
        orders: {
          select: {
            id: true,
            totalAmount: true,
            status: true,
          },
        },
      },
      orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }],
      take: query.limit,
      skip: query.offset,
    }),
      this.prisma.invoice.count({ where }),
    ]);

    return { data: invoices.map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      company: invoice.company,
      status: invoice.status,
      totalAmount: toFixed(invoice.totalAmount),
      issuedAt: invoice.issuedAt.toISOString(),
      paidAt: invoice.paidAt?.toISOString() ?? null,
      orderCount: invoice.orders.length,
      orders: invoice.orders.map((order) => ({
        id: order.id,
        status: order.status,
        totalAmount: toFixed(order.totalAmount),
      })),
    })), meta: { total, limit: query.limit ?? 25, offset: query.offset ?? 0 } };
  }

  async getInvoice(invoiceId: number) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        company: { select: { id: true, name: true } },
        orders: {
          select: {
            id: true,
            status: true,
            totalAmount: true,
            employee: { select: { id: true, name: true, email: true } },
            deliveryDate: true,
            deliveryTime: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice was not found');
    }

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      company: invoice.company,
      status: invoice.status,
      totalAmount: toFixed(invoice.totalAmount),
      issuedAt: invoice.issuedAt.toISOString(),
      paidAt: invoice.paidAt?.toISOString() ?? null,
      orders: invoice.orders.map((order) => ({
        id: order.id,
        status: order.status,
        totalAmount: toFixed(order.totalAmount),
        employee: order.employee,
        deliveryDate: order.deliveryDate.toISOString().slice(0, 10),
        deliveryTime: order.deliveryTime.toISOString().slice(11, 16),
      })),
    };
  }

  async createInvoice(dto: CreateInvoiceDto, now = new Date()) {
    const orderIds = [...new Set(dto.orderIds.map((value) => Number(value)))];
    if (orderIds.length === 0) {
      throw new BadRequestException('At least one order must be selected');
    }

    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.findUnique({
        where: { id: dto.companyId },
        select: { id: true },
      });
      if (!company) {
        throw new NotFoundException('Company was not found');
      }

      await tx.$queryRaw<Array<{ id: number }>>`
        SELECT "id" FROM "Order" WHERE "id" IN (${Prisma.join(orderIds)}) FOR UPDATE
      `;

      const orders = await tx.order.findMany({
        where: {
          id: { in: orderIds },
          companyId: dto.companyId,
          status: OrderStatus.CONFIRMED,
          invoiceId: null,
        },
        select: {
          id: true,
          totalAmount: true,
          invoiceId: true,
          status: true,
          companyId: true,
        },
      });

      if (orders.length !== orderIds.length) {
        throw new BadRequestException('One or more selected orders are invalid for this invoice');
      }

      const totalAmount = orders.reduce(
        (sum, order) => sum.plus(order.totalAmount),
        new Prisma.Decimal(0),
      );
      const invoiceNumber = await this.generateInvoiceNumber(tx);

      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          companyId: dto.companyId,
          totalAmount,
          status: InvoiceStatus.ISSUED,
          issuedAt: now,
        },
      });

      const updateResult = await tx.order.updateMany({
        where: {
          id: { in: orderIds },
          companyId: dto.companyId,
          invoiceId: null,
          status: OrderStatus.CONFIRMED,
        },
        data: {
          invoiceId: invoice.id,
          updatedAt: now,
        },
      });

      if (updateResult.count !== orderIds.length) {
        throw new ConflictException('Order assignment changed while creating the invoice');
      }

      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        companyId: invoice.companyId,
        status: invoice.status,
        totalAmount: toFixed(invoice.totalAmount),
        issuedAt: invoice.issuedAt.toISOString(),
        paidAt: invoice.paidAt?.toISOString() ?? null,
        orderIds,
      };
    });
  }

  async markInvoicePaid(invoiceId: number, now = new Date()) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        select: {
          id: true,
          status: true,
          paidAt: true,
          invoiceNumber: true,
          companyId: true,
        },
      });
      if (!invoice) {
        throw new NotFoundException('Invoice was not found');
      }
      if (invoice.status !== InvoiceStatus.ISSUED) {
        throw new ConflictException('Only issued invoices can be marked as paid');
      }

      const updated = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: InvoiceStatus.PAID,
          paidAt: invoice.paidAt ?? now,
        },
      });

      return {
        id: updated.id,
        invoiceNumber: updated.invoiceNumber,
        companyId: updated.companyId,
        status: updated.status,
        issuedAt: updated.issuedAt.toISOString(),
        paidAt: updated.paidAt?.toISOString() ?? null,
      };
    });
  }

  private async generateInvoiceNumber(tx: Prisma.TransactionClient) {
    const latest = await tx.invoice.findFirst({
      orderBy: { id: 'desc' },
      select: { id: true },
    });
    const nextNumber = (latest?.id ?? 0) + 1;
    return `INV-${String(nextNumber).padStart(6, '0')}`;
  }

  private dateRange(from?: string, to?: string): Prisma.DateTimeFilter {
    return {
      ...(from ? { gte: toIstDateTime(from, '00:00') } : {}),
      ...(to ? { lt: toIstDateTime(addCalendarDays(to, 1), '00:00') } : {}),
    };
  }

  private assertInvoiceDateRange(from: string | undefined, to: string | undefined, label: string) {
    if (from) assertCalendarDate(from);
    if (to) assertCalendarDate(to);
    if (from && to && from > to) {
      throw new BadRequestException(`${label} date from must be on or before ${label} date to`);
    }
  }
}

function toFixed(value: Prisma.Decimal | number | string) {
  const decimal = value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
  return decimal.toFixed(2);
}
