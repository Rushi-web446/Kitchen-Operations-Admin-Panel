import 'dotenv/config';
import {
  KitchenUnitStatus,
  OrderStatus,
  Prisma,
} from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/database/prisma.service.js';
import { KitchenUnitProvisioningService } from '../src/kitchen/kitchen-unit-provisioning.service.js';
import { KitchenUnitWorkflowService } from '../src/kitchen/kitchen-unit-workflow.service.js';

describe('Kitchen workflow (Supabase integration)', () => {
  let prisma: PrismaService;
  let orderId: number | undefined;
  let combinationIds: number[] = [];

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required for the Kitchen integration test');
    }
    const databaseUrl = new URL(process.env.DATABASE_URL);
    if (databaseUrl.port === '6543') {
      databaseUrl.port = '5432';
      databaseUrl.searchParams.delete('pgbouncer');
    }
    databaseUrl.searchParams.set('connect_timeout', '15');
    process.env.DATABASE_URL = databaseUrl.toString();

    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    if (orderId !== undefined) {
      await prisma.$transaction(async (tx) => {
        await tx.kitchenUnit.deleteMany({
          where: { orderCombination: { orderLine: { orderId } } },
        });
        await tx.orderCombinationOption.deleteMany({
          where: { combination: { orderLine: { orderId } } },
        });
        await tx.orderCombination.deleteMany({ where: { orderLine: { orderId } } });
        await tx.orderLine.deleteMany({ where: { orderId } });
        await tx.orderStatusHistory.deleteMany({ where: { orderId } });
        await tx.order.delete({ where: { id: orderId } });
      });
    }
    await prisma?.$disconnect();
  });

  it('provisions once per combination and safely processes concurrent completion', async () => {
    const employee = await prisma.employee.findFirst({
      where: { email: 'alex@fernleaftest.example' },
      include: { company: true },
    });
    const dish = await prisma.dish.findUnique({ where: { sku: 'HZ-RICE-001' } });
    expect(employee).not.toBeNull();
    expect(dish).not.toBeNull();

    const order = await prisma.order.create({
      data: {
        employeeId: employee!.id,
        companyId: employee!.companyId,
        status: OrderStatus.CONFIRMED,
        deliveryDate: new Date('2090-01-01T00:00:00.000Z'),
        deliveryTime: new Date('1970-01-01T12:00:00.000Z'),
        deliveryAddressSnapshot: { line1: 'Kitchen workflow test fixture' },
        packaging: 'Kitchen workflow test fixture',
        totalAmount: new Prisma.Decimal('2.00'),
      },
      select: { id: true },
    });
    orderId = order.id;

    const line = await prisma.orderLine.create({
      data: {
        orderId,
        dishId: dish!.id,
        quantity: 2,
        dishNameSnapshot: dish!.name,
        dishSkuSnapshot: dish!.sku,
        dishUnitPriceSnapshot: new Prisma.Decimal('1.00'),
        lineTotal: new Prisma.Decimal('2.00'),
      },
      select: { id: true },
    });
    const combinations = await Promise.all([
      prisma.orderCombination.create({
        data: {
          orderLineId: line.id,
          quantity: 1,
          unitPrice: new Prisma.Decimal('1.00'),
          totalPrice: new Prisma.Decimal('1.00'),
        },
        select: { id: true },
      }),
      prisma.orderCombination.create({
        data: {
          orderLineId: line.id,
          quantity: 1,
          unitPrice: new Prisma.Decimal('1.00'),
          totalPrice: new Prisma.Decimal('1.00'),
        },
        select: { id: true },
      }),
    ]);
    combinationIds = combinations.map((combination) => combination.id);

    const provisioner = new KitchenUnitProvisioningService();
    const firstProvision = await prisma.$transaction((tx) =>
      provisioner.ensureForConfirmedOrder(tx, orderId!),
    );
    const retryProvision = await prisma.$transaction((tx) =>
      provisioner.ensureForConfirmedOrder(tx, orderId!),
    );
    expect(firstProvision).toBe(2);
    expect(retryProvision).toBe(0);

    const units = await prisma.kitchenUnit.findMany({
      where: { orderCombinationId: { in: combinationIds } },
      orderBy: { id: 'asc' },
    });
    expect(units).toHaveLength(2);
    expect(units.every((unit) => unit.status === KitchenUnitStatus.NOT_STARTED)).toBe(true);
    expect(units.every((unit) => unit.kitchenStation === (dish!.kitchenStation ?? 'UNASSIGNED'))).toBe(true);

    const workflow = new KitchenUnitWorkflowService(prisma);
    const firstStartedAt = new Date('2090-01-01T04:00:00.000Z');
    const laterStartedAt = new Date('2090-01-01T04:05:00.000Z');
    await workflow.start(units[0].id, firstStartedAt);
    await workflow.start(units[1].id, laterStartedAt);

    const beforeDone = await prisma.order.findUnique({
      where: { id: orderId },
      select: { kitchenStartedAt: true, kitchenReadyAt: true },
    });
    expect(beforeDone?.kitchenStartedAt).toEqual(firstStartedAt);
    expect(beforeDone?.kitchenReadyAt).toBeNull();

    await Promise.all([
      workflow.complete(units[0].id, new Date('2090-01-01T05:00:00.000Z')),
      workflow.complete(units[1].id, new Date('2090-01-01T05:01:00.000Z')),
    ]);

    const finalState = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        kitchenStartedAt: true,
        kitchenReadyAt: true,
        lines: {
          select: {
            combinations: {
              select: { kitchenUnits: { select: { status: true, startedAt: true, doneAt: true } } },
            },
          },
        },
      },
    });
    const finalUnits = finalState!.lines.flatMap((item) =>
      item.combinations.flatMap((combination) => combination.kitchenUnits),
    );
    expect(finalState?.kitchenStartedAt).toEqual(firstStartedAt);
    expect(finalState?.kitchenReadyAt).not.toBeNull();
    expect(finalUnits.every((unit) => unit.status === KitchenUnitStatus.DONE)).toBe(true);
    expect(finalUnits.every((unit) => unit.startedAt && unit.doneAt)).toBe(true);
  }, 30_000);
});