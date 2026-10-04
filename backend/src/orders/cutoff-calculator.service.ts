import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Weekday } from '@prisma/client';
import { addCalendarDays, getWeekday, toIstDateTime } from './calendar-time';

export interface CutoffCalculationInput {
  deliveryDate: string;
  cutoffWorkingDays: number;
  cutoffTime: string;
  workingDays: readonly Weekday[];
  holidays: readonly string[];
}

@Injectable()
export class CutoffCalculatorService {
  calculateCutoffAt(input: CutoffCalculationInput): Date {
    if (!Number.isInteger(input.cutoffWorkingDays) || input.cutoffWorkingDays < 1) {
      throw new InternalServerErrorException(
        'Kitchen cutoffWorkingDays must be a positive integer.',
      );
    }
    if (input.workingDays.length === 0) {
      throw new InternalServerErrorException(
        'Kitchen calendar must contain at least one working day.',
      );
    }

    const workingDays = new Set(input.workingDays);
    const holidays = new Set(input.holidays);
    let candidate = input.deliveryDate;
    let countedDays = 0;

    while (countedDays < input.cutoffWorkingDays) {
      candidate = addCalendarDays(candidate, -1);

      if (workingDays.has(getWeekday(candidate)) && !holidays.has(candidate)) {
        countedDays += 1;
      }
    }

    return toIstDateTime(candidate, input.cutoffTime);
  }
}