import 'dotenv/config';
import { OrderStatus, Prisma } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/database/prisma.service.js';

describe('Order database transaction (integration)', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required to run the order transaction integration test');
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
    await prisma?.$disconnect();
  });

  it('rolls back an Order when a child OrderLine insert fails', async () => {
    const employee = await prisma.employee.findFirst({
      where: { email: 'alex@fernleaftest.example' },
      include: { company: true },
    });
    expect(employee).not.toBeNull();

    const calendar = await prisma.kitchenCalendarConfig.findUnique({ where: { id: 1 } });
    expect(calendar).not.toBeNull();

    const deliveryDate = new Date('2030-10-07T00:00:00.000Z');
    const deliveryTime = new Date('1970-01-01T12:00:00.000Z');
    const createdId: { value: number | null } = { value: null };

    await expect(
      prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            employeeId: employee!.id,
            companyId: employee!.companyId,
            status: OrderStatus.DRAFT,
            deliveryDate,
            deliveryTime,
            deliveryAddressSnapshot: { line1: 'Rollback test address' },
            packaging: 'Rollback test',
            totalAmount: new Prisma.Decimal('1.00'),
          },
          select: { id: true },
        });
        createdId.value = order.id;

        await tx.orderLine.create({
          data: {
            orderId: order.id,
            dishId: 2_147_483_647,
            quantity: 1,
            dishNameSnapshot: 'Invalid child fixture',
            dishSkuSnapshot: 'INVALID-ROLLBACK',
            dishUnitPriceSnapshot: new Prisma.Decimal('1.00'),
            lineTotal: new Prisma.Decimal('1.00'),
          },
        });
      }),
    ).rejects.toThrow();

    expect(createdId.value).not.toBeNull();
    await expect(
      prisma.order.findUnique({ where: { id: createdId.value! } }),
    ).resolves.toBeNull();
  });
});