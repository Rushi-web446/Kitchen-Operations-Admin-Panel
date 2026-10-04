import { BadRequestException, Injectable } from '@nestjs/common';
import { toIstDateTime } from './calendar-time';

export const KITCHEN_READY_BUFFER_MINUTES = 30;
const MILLISECONDS_PER_MINUTE = 60_000;

export interface OrderPlanningInput {
  deliveryDate: string;
  deliveryTime: string;
  deliveryMinutes: number;
}

export interface OrderPlanningResult {
  plannedDispatchReadyAt: Date;
  plannedKitchenReadyAt: Date;
}

@Injectable()
export class OrderPlanningService {
  calculate(input: OrderPlanningInput): OrderPlanningResult {
    if (!Number.isInteger(input.deliveryMinutes) || input.deliveryMinutes < 0) {
      throw new BadRequestException('Company deliveryMinutes is invalid');
    }

    const deliveryAt = toIstDateTime(input.deliveryDate, input.deliveryTime);
    const plannedDispatchReadyAt = new Date(
      deliveryAt.getTime() - input.deliveryMinutes * MILLISECONDS_PER_MINUTE,
    );

    return {
      plannedDispatchReadyAt,
      plannedKitchenReadyAt: new Date(
        plannedDispatchReadyAt.getTime() -
          KITCHEN_READY_BUFFER_MINUTES * MILLISECONDS_PER_MINUTE,
      ),
    };
  }
}