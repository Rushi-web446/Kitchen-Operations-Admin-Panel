import { Prisma } from '@prisma/client';
import { formatCalendarDate, formatDatabaseTime } from './calendar-time';

export const ORDER_RESPONSE_SELECT = {
  id: true,
  status: true,
  deliveryDate: true,
  deliveryTime: true,
  deliveryAddressSnapshot: true,
  packaging: true,
  totalAmount: true,
  cutoffAt: true,
  plannedDispatchReadyAt: true,
  plannedKitchenReadyAt: true,
  createdAt: true,
  invoice: { select: { id: true, invoiceNumber: true, status: true, issuedAt: true, paidAt: true } },
  statusHistory: { orderBy: { createdAt: 'asc' }, select: { status: true, createdAt: true } },
  employee: { select: { id: true, name: true, email: true } },
  company: { select: { id: true, name: true } },
  lines: {
    orderBy: { id: 'asc' },
    select: {
      id: true,
      dishId: true,
      quantity: true,
      dishNameSnapshot: true,
      dishSkuSnapshot: true,
      dishUnitPriceSnapshot: true,
      lineTotal: true,
      combinations: {
        orderBy: { id: 'asc' },
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          totalPrice: true,
          options: {
            orderBy: { id: 'asc' },
            select: {
              id: true,
              optionId: true,
              optionGroupIdSnapshot: true,
              portionSizeIdSnapshot: true,
              optionNameSnapshot: true,
              optionPriceSnapshot: true,
              portionNameSnapshot: true,
              portionExtraPriceSnapshot: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.OrderSelect;

export type OrderResponseRecord = Prisma.OrderGetPayload<{
  select: typeof ORDER_RESPONSE_SELECT;
}>;

export function toOrderResponse(order: OrderResponseRecord) {
  return {
    id: order.id,
    status: order.status,
    employee: order.employee,
    company: order.company,
    deliveryDate: formatCalendarDate(order.deliveryDate),
    deliveryTime: formatDatabaseTime(order.deliveryTime),
    deliveryAddressSnapshot: order.deliveryAddressSnapshot,
    packaging: order.packaging,
    cutoffAt: order.cutoffAt?.toISOString() ?? null,
    plannedDispatchReadyAt: order.plannedDispatchReadyAt?.toISOString() ?? null,
    plannedKitchenReadyAt: order.plannedKitchenReadyAt?.toISOString() ?? null,
    totalAmount: order.totalAmount.toFixed(2),
    createdAt: order.createdAt.toISOString(),
    invoice: order.invoice
      ? {
          id: order.invoice.id,
          invoiceNumber: order.invoice.invoiceNumber,
          status: order.invoice.status,
          issuedAt: order.invoice.issuedAt.toISOString(),
          paidAt: order.invoice.paidAt?.toISOString() ?? null,
        }
      : null,
    timeline: order.statusHistory.map((entry) => ({
      status: entry.status,
      occurredAt: entry.createdAt.toISOString(),
    })),
    lines: order.lines.map((line) => ({
      id: line.id,
      dishId: line.dishId,
      dishName: line.dishNameSnapshot,
      dishSku: line.dishSkuSnapshot,
      quantity: line.quantity,
      dishUnitPrice: line.dishUnitPriceSnapshot.toFixed(2),
      lineTotal: line.lineTotal.toFixed(2),
      combinations: line.combinations.map((combination) => ({
        id: combination.id,
        quantity: combination.quantity,
        unitPrice: combination.unitPrice.toFixed(2),
        totalPrice: combination.totalPrice.toFixed(2),
        options: combination.options.map((option) => ({
          id: option.id,
          optionId: option.optionId,
          optionGroupId: option.optionGroupIdSnapshot,
          portionId: option.portionSizeIdSnapshot,
          name: option.optionNameSnapshot,
          unitPrice: option.optionPriceSnapshot.toFixed(2),
          portionName: option.portionNameSnapshot,
          portionExtraPrice: option.portionExtraPriceSnapshot.toFixed(2),
        })),
      })),
    })),
  };
}