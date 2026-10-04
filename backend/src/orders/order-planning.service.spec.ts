import { describe, expect, it } from 'vitest';
import { OrderPlanningService } from './order-planning.service';

describe('OrderPlanningService', () => {
  const planner = new OrderPlanningService();

  it('plans dispatch and kitchen-ready times in IST', () => {
    const result = planner.calculate({
      deliveryDate: '2026-10-06',
      deliveryTime: '12:00',
      deliveryMinutes: 60,
    });

    expect(result.plannedDispatchReadyAt.toISOString()).toBe(
      '2026-10-06T05:30:00.000Z',
    );
    expect(result.plannedKitchenReadyAt.toISOString()).toBe(
      '2026-10-06T05:00:00.000Z',
    );
  });

  it('rejects invalid delivery lead time', () => {
    expect(() =>
      planner.calculate({
        deliveryDate: '2026-10-06',
        deliveryTime: '12:00',
        deliveryMinutes: -1,
      }),
    ).toThrow('Company deliveryMinutes is invalid');
  });
});