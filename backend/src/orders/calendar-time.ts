import { BadRequestException } from '@nestjs/common';
import { Weekday } from '@prisma/client';

export const APPLICATION_TIME_ZONE = 'Asia/Kolkata';
export const IST_OFFSET_MINUTES = 330;

const WEEKDAY_BY_UTC_DAY: Weekday[] = [
  Weekday.SUNDAY,
  Weekday.MONDAY,
  Weekday.TUESDAY,
  Weekday.WEDNESDAY,
  Weekday.THURSDAY,
  Weekday.FRIDAY,
  Weekday.SATURDAY,
];

export function assertCalendarDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException('deliveryDate must use YYYY-MM-DD format');
  }

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new BadRequestException('deliveryDate is not a valid calendar date');
  }
}

export function assertClockTime(value: string): void {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) {
    throw new BadRequestException('Time must use HH:mm or HH:mm:ss format');
  }

  const [, hours, minutes, seconds = '0'] = match;
  if (
    Number(hours) > 23 ||
    Number(minutes) > 59 ||
    Number(seconds) > 59
  ) {
    throw new BadRequestException('Time is outside the valid clock range');
  }
}

export function addCalendarDays(date: string, days: number): string {
  assertCalendarDate(date);
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return formatCalendarDate(value);
}

export function getWeekday(date: string): Weekday {
  assertCalendarDate(date);
  const [year, month, day] = date.split('-').map(Number);
  return WEEKDAY_BY_UTC_DAY[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

export function toDatabaseDate(date: string): Date {
  assertCalendarDate(date);
  return new Date(`${date}T00:00:00.000Z`);
}

export function toDatabaseTime(time: string): Date {
  assertClockTime(time);
  return new Date(`1970-01-01T${time.length === 5 ? `${time}:00` : time}.000Z`);
}

export function formatCalendarDate(date: Date): string {
  return [
    String(date.getUTCFullYear()).padStart(4, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

export function formatDatabaseTime(time: Date): string {
  return `${String(time.getUTCHours()).padStart(2, '0')}:${String(
    time.getUTCMinutes(),
  ).padStart(2, '0')}`;
}

export function toIstDateTime(date: string, time: string): Date {
  assertCalendarDate(date);
  assertClockTime(time);
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes, seconds = 0] = time.split(':').map(Number);
  const utcMilliseconds = Date.UTC(
    year,
    month - 1,
    day,
    hours,
    minutes,
    seconds,
  );
  return new Date(utcMilliseconds - IST_OFFSET_MINUTES * 60_000);
}
