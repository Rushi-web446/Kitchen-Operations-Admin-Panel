import { ConflictException } from '@nestjs/common';
import { KitchenUnitStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../database/prisma.service';
import { SettingsService } from './settings.service';

describe('SettingsService kitchen stations', () => {
  it('normalizes new station codes before saving', async () => {
    const create = vi.fn(async ({ data }: { data: { name: string } }) => ({
      id: 5,
      ...data,
      active: true,
    }));
    const service = new SettingsService({
      kitchenStationReference: { create },
    } as unknown as PrismaService);

    await service.createKitchenStation('  bakery   prep ');

    expect(create).toHaveBeenCalledWith({ data: { name: 'BAKERY_PREP' } });
  });

  it('prevents deactivating stations still used by active dishes or unfinished units', async () => {
    const service = new SettingsService({
      kitchenStationReference: {
        findUnique: vi.fn(async () => ({ id: 1, name: 'GRILL' })),
        update: vi.fn(),
      },
      dish: { count: vi.fn(async () => 1) },
      kitchenUnit: {
        count: vi.fn(async ({ where }: { where: { status: { not: KitchenUnitStatus } } }) =>
          where.status.not === KitchenUnitStatus.DONE ? 0 : 0,
        ),
      },
    } as unknown as PrismaService);

    await expect(service.updateKitchenStation(1, false)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('creates reusable portion-size references with normalized spacing', async () => {
    const create = vi.fn(async ({ data }: { data: { name: string } }) => data);
    const service = new SettingsService({
      portionSizeReference: { create },
    } as unknown as PrismaService);

    await service.createPortionSize('  Extra   large ');

    expect(create).toHaveBeenCalledWith({ data: { name: 'Extra large' } });
  });

  it('prevents deactivating a portion size referenced by option groups', async () => {
    const service = new SettingsService({
      portionSizeReference: {
        findUnique: vi.fn(async () => ({ id: 2 })),
        update: vi.fn(),
      },
      optionPortion: { count: vi.fn(async () => 1) },
    } as unknown as PrismaService);

    await expect(service.updatePortionSize(2, false)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
