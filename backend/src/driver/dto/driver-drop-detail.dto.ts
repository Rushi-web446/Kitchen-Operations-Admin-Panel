import { DeliveryDropStatus, OrderStatus } from '@prisma/client';

export interface DriverOrderDetailDto {
  id: number;
  status: OrderStatus;
  employee: { id: number; name: string; email: string };
  totalAmount: string;
  packaging: string;
}

export interface DriverDropDetailDto {
  id: number;
  company: { id: number; name: string };
  deliveryDate: string;
  deliveryTime: string;
  deliveryAddressSnapshot: unknown;
  driverInstructions: string | null;
  status: DeliveryDropStatus;
  orderCount: number;
  orders: DriverOrderDetailDto[];
  driver: { id: number; name: string; email: string } | null;
  outForDeliveryAt: string | null;
  deliveredAt: string | null;
  onTime: boolean | null;
  deliveryNote: string | null;
  deliveryPhotoUrl: string | null;
}
