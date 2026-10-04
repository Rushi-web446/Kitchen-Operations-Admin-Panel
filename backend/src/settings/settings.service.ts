import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { KitchenUnitStatus, Prisma, Weekday } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateKitchenHolidayDto, UpdateSettingsDto } from './dto/settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const config = await this.prisma.kitchenCalendarConfig.findUnique({
      where: { id: 1 },
      include: { holidays: { orderBy: { date: 'asc' } } },
    });
    if (!config) throw new NotFoundException('Kitchen calendar settings are not configured');
    return formatConfig(config);
  }

  async update(dto: UpdateSettingsDto) {
    if (new Set(dto.workingDays).size !== dto.workingDays.length) {
      throw new BadRequestException('Working days must not contain duplicates');
    }
    const config = await this.prisma.kitchenCalendarConfig.upsert({
      where: { id: 1 },
      update: {
        cutoffWorkingDays: dto.cutoffWorkingDays,
        cutoffTime: databaseTime(dto.cutoffTime),
        workingDays: dto.workingDays,
      },
      create: {
        id: 1,
        cutoffWorkingDays: dto.cutoffWorkingDays,
        cutoffTime: databaseTime(dto.cutoffTime),
        workingDays: dto.workingDays,
      },
      include: { holidays: { orderBy: { date: 'asc' } } },
    });
    return formatConfig(config);
  }

  async addHoliday(dto: CreateKitchenHolidayDto) {
    const date = databaseDate(dto.date);
    await this.prisma.kitchenCalendarConfig.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        cutoffWorkingDays: 2,
        cutoffTime: databaseTime('16:00'),
        workingDays: [Weekday.MONDAY, Weekday.TUESDAY, Weekday.WEDNESDAY, Weekday.THURSDAY, Weekday.FRIDAY],
      },
    });
    try {
      const holiday = await this.prisma.kitchenHoliday.create({
        data: { date, description: dto.description, calendarId: 1 },
      });
      return { ...holiday, date: dto.date };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('That kitchen holiday already exists');
      }
      throw error;
    }
  }

  async removeHoliday(id: number) {
    const removed = await this.prisma.kitchenHoliday.deleteMany({ where: { id, calendarId: 1 } });
    if (removed.count === 0) throw new NotFoundException('Kitchen holiday was not found');
    return { success: true };
  }

  listKitchenStations(includeInactive = true) {
    return this.prisma.kitchenStationReference.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: { name: 'asc' },
    });
  }

  listPortionSizes(includeInactive = true) {
    return this.prisma.portionSizeReference.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: { name: 'asc' },
    });
  }

  async createPortionSize(name: string) {
    const normalizedName = name.trim().replace(/\s+/g, ' ');
    if (!normalizedName) throw new BadRequestException('Portion size name is required');
    try {
      return await this.prisma.portionSizeReference.create({
        data: { name: normalizedName },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A portion size with that name already exists');
      }
      throw error;
    }
  }

  async updatePortionSize(id: number, active: boolean) {
    const portionSize = await this.prisma.portionSizeReference.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!portionSize) throw new NotFoundException('Portion size was not found');
    if (!active) {
      const usageCount = await this.prisma.optionPortion.count({
        where: { portionSizeId: id },
      });
      if (usageCount) {
        throw new ConflictException('Remove this portion size from option groups before deactivating it');
      }
    }
    return this.prisma.portionSizeReference.update({
      where: { id },
      data: { active },
    });
  }

  async createKitchenStation(name: string) {
    const normalizedName = normalizeStationName(name);
    if (!normalizedName) throw new BadRequestException('Station name is required');
    try {
      return await this.prisma.kitchenStationReference.create({
        data: { name: normalizedName },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A kitchen station with that name already exists');
      }
      throw error;
    }
  }

  async updateKitchenStation(id: number, active: boolean) {
    const station = await this.prisma.kitchenStationReference.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!station) throw new NotFoundException('Kitchen station was not found');
    if (!active) {
      const [assignedDishes, unfinishedUnits] = await Promise.all([
        this.prisma.dish.count({ where: { kitchenStation: station.name, active: true } }),
        this.prisma.kitchenUnit.count({
          where: { kitchenStation: station.name, status: { not: KitchenUnitStatus.DONE } },
        }),
      ]);
      if (assignedDishes || unfinishedUnits) {
        throw new ConflictException('Reassign active dishes and finish pending kitchen work before deactivating this station');
      }
    }
    return this.prisma.kitchenStationReference.update({
      where: { id },
      data: { active },
    });
  }
}

function normalizeStationName(name: string) {
  return name.trim().replace(/\s+/g, '_').toUpperCase();
}

function databaseDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.toISOString().slice(0, 10) !== value) throw new BadRequestException('Invalid calendar date');
  return date;
}

function databaseTime(value: string) {
  return new Date(`1970-01-01T${value}:00.000Z`);
}

function formatConfig<T extends {
  cutoffTime: Date;
  workingDays: Weekday[];
  holidays: Array<{ id: number; date: Date; description: string | null }>;
}>(config: T) {
  return {
    ...config,
    timezone: 'Asia/Kolkata',
    cutoffTime: `${String(config.cutoffTime.getUTCHours()).padStart(2, '0')}:${String(config.cutoffTime.getUTCMinutes()).padStart(2, '0')}`,
    holidays: config.holidays.map((holiday) => ({ ...holiday, date: holiday.date.toISOString().slice(0, 10) })),
  };
}
