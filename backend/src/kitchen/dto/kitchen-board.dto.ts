import {  KitchenUnitStatus } from '@prisma/client';

export interface KitchenUnitBoardItem {
  id: number;
  orderCombinationId: number;
  dishName: string;
  dishSku: string;
  quantity: number;
  station: string;
  status: KitchenUnitStatus;
  startedAt: string | null;
  doneAt: string | null;
  selectedOptions: Array<{ id: number; name: string }>;
}

export interface KitchenOrderBoardItem {
  id: number;
  deliveryDate: string;
  deliveryTime: string;
  plannedKitchenReadyAt: string | null;
  kitchenStartedAt: string | null;
  kitchenReadyAt: string | null;
  employee: { id: number; name: string; email: string };
  company: { id: number; name: string };
  units: KitchenUnitBoardItem[];
  progress: { completedUnits: number; totalUnits: number };
  isAtRisk: boolean;
}