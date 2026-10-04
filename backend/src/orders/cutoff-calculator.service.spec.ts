import { Weekday } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { CutoffCalculatorService } from './cutoff-calculator.service';

const weekdays = [
  Weekday.MONDAY,
  Weekday.TUESDAY,
  Weekday.WEDNESDAY,
  Weekday.THURSDAY,
  Weekday.FRIDAY,
];

describe('CutoffCalculatorService', () => {
  const calculator = new CutoffCalculatorService();

  it('counts backward working days from the delivery date', () => {
    const cutoff = calculator.calculateCutoffAt({
      deliveryDate: '2026-10-07',
      cutoffWorkingDays: 2,
      cutoffTime: '16:00',
      workingDays: weekdays,
      holidays: [],
    });

    expect(cutoff.toISOString()).toBe('2026-10-05T10:30:00.000Z');
  });

  it('skips configurable non-working weekend days', () => {
    const cutoff = calculator.calculateCutoffAt({
      deliveryDate: '2026-10-12',
      cutoffWorkingDays: 2,
      cutoffTime: '15:20',
      workingDays: weekdays,
      holidays: [],
    });

    expect(cutoff.toISOString()).toBe('2026-10-08T09:50:00.000Z');
  });

  it('skips kitchen holidays, including consecutive holidays', () => {
    const cutoff = calculator.calculateCutoffAt({
      deliveryDate: '2026-10-08',
      cutoffWorkingDays: 2,
      cutoffTime: '16:00',
      workingDays: weekdays,
      holidays: ['2026-10-07', '2026-10-06'],
    });

    expect(cutoff.toISOString()).toBe('2026-10-02T10:30:00.000Z');
  });

  it('supports arbitrary working-day counts and calendars that work weekends', () => {
    const cutoff = calculator.calculateCutoffAt({
      deliveryDate: '2026-10-12',
      cutoffWorkingDays: 4,
      cutoffTime: '09:05',
      workingDays: [Weekday.MONDAY, Weekday.WEDNESDAY, Weekday.SATURDAY],
      holidays: ['2026-10-10'],
    });

    expect(cutoff.toISOString()).toBe('2026-09-30T03:35:00.000Z');
  });

  it('interprets the cutoff clock as IST independently of host timezone', () => {
    const cutoff = calculator.calculateCutoffAt({
      deliveryDate: '2026-10-07',
      cutoffWorkingDays: 1,
      cutoffTime: '08:45',
      workingDays: weekdays,
      holidays: [],
    });

    expect(cutoff.toISOString()).toBe('2026-10-06T03:15:00.000Z');
  });
});