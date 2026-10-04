import { DeliveryDropStatus, OrderStatus } from '@prisma/client';

export interface DispatchOrderSummaryDto {
  id: number;
  status: OrderStatus;
  kitchenReadyAt: string | null;
  employee: { id: number; name: string; email: string };
  totalAmount: string;
}

export interface DispatchDropDto {
  id: number;
  company: { id: number; name: string };
  deliveryDate: string;
  deliveryTime: string;
  deliveryAddressSnapshot: unknown;
  status: DeliveryDropStatus;
  orderCount: number;
  orders: DispatchOrderSummaryDto[];
  driver: { id: number; name: string; email: string } | null;
  defaultDriver: { id: number; name: string; email: string } | null;
  allOrdersKitchenReady: boolean;
  canGoOutForDelivery: boolean;
  isOutForDelivery: boolean;
  isDelivered: boolean;
  outForDeliveryAt: string | null;
  deliveredAt: string | null;
  onTime: boolean | null;
  deliveryNote: string | null;
  deliveryPhotoUrl: string | null;
}