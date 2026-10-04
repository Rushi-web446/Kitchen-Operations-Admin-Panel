import 'dotenv/config';
import { DeliveryDropStatus, OrderStatus, Prisma, Role } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/database/prisma.service.js';
import { DriverDropService } from '../src/driver/driver-drop.service.js';
import { DispatchWorkflowService } from '../src/dispatch/dispatch-workflow.service.js';
import { DropGroupingService } from '../src/dispatch/drop-grouping.service.js';
import { toIstDateTime } from '../src/orders/calendar-time.js';

describe('Dispatch and Driver workflow (Supabase integration)', () => {
  let prisma: PrismaService;
  let companyAId: number;
  let companyBId: number;
  let employeeAId: number;
  let employeeBId: number;
  let overrideDriverId: number | undefined;
  let overrideDriverUserId: number | undefined;
  let deliveryDate: string;
  let dateValue: Date;
  let orderIds: number[] = [];

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required for Dispatch integration tests');
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

    const companyA = await prisma.company.findFirst({
      where: { name: 'Fernleaf Test Company' },
      include: { employees: true, defaultDriver: true },
    });
    if (!companyA || companyA.employees.length === 0 || !companyA.defaultDriver) {
      throw new Error('Seed company, employee, and default driver are required');
    }
    companyAId = companyA.id;
    employeeAId = companyA.employees[0].id;

    const suffix = Date.now();
    const companyB = await prisma.company.create({
      data: { name: `Dispatch Integration Company ${suffix}` },
      select: { id: true },
    });
    companyBId = companyB.id;
    const overrideDriverUser = await prisma.user.create({
      data: {
        name: 'Dispatch Override Driver',
        email: `dispatch-override-${suffix}@example.invalid`,
        passwordHash: 'integration-test-only-hash',
        role: Role.DRIVER,
      },
      select: { id: true },
    });
    overrideDriverUserId = overrideDriverUser.id;
    const overrideDriver = await prisma.driver.create({
      data: { userId: overrideDriverUserId, companyId: companyAId },
      select: { id: true },
    });
    overrideDriverId = overrideDriver.id;
    const employeeB = await prisma.employee.create({
      data: {
        companyId: companyBId,
        name: 'Dispatch Fixture Employee',
        email: `dispatch-fixture-${suffix}@example.invalid`,
      },
      select: { id: true },
    });
    employeeBId = employeeB.id;

    const now = new Date();
    deliveryDate = new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
    dateValue = new Date(`${deliveryDate}T00:00:00.000Z`);
  });

  afterAll(async () => {
    if (orderIds.length > 0) {
      await prisma.$transaction(async (tx) => {
        const drops = await tx.deliveryDrop.findMany({
          where: { orders: { some: { id: { in: orderIds } } } },
          select: { id: true },
        });
        const dropIds = drops.map((drop) => drop.id);
        await tx.order.updateMany({
          where: { id: { in: orderIds } },
          data: { deliveryDropId: null },
        });
        await tx.deliveryDrop.deleteMany({ where: { id: { in: dropIds } } });
        await tx.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } });
        await tx.order.deleteMany({ where: { id: { in: orderIds } } });
      });
    }
    if (employeeBId) await prisma.employee.delete({ where: { id: employeeBId } });
    if (companyBId) await prisma.company.delete({ where: { id: companyBId } });
    if (overrideDriverId) await prisma.driver.delete({ where: { id: overrideDriverId } });
    if (overrideDriverUserId) await prisma.user.delete({ where: { id: overrideDriverUserId } });
    await prisma?.$disconnect();
  });

  it('groups exact matches only, inherits defaults, transitions sequentially and delivers atomically', async () => {
    const companyA = await prisma.company.findUniqueOrThrow({
      where: { id: companyAId },
      select: { defaultDriverId: true },
    });

    const createOrder = async (input: {
      companyId: number;
      employeeId: number;
      addressLine1: string;
      recipientName: string;
      time: string;
      kitchenReady: boolean;
      status?: OrderStatus;
    }) => {
      const order = await prisma.order.create({
        data: {
          companyId: input.companyId,
          employeeId: input.employeeId,
          status: input.status ?? OrderStatus.CONFIRMED,
          deliveryDate: dateValue,
          deliveryTime: new Date(`1970-01-01T${input.time}:00.000Z`),
          deliveryAddressSnapshot: {
            recipientName: input.recipientName,
            addressLine1: input.addressLine1,
            city: 'Pune',
            region: 'Maharashtra',
            postalCode: '411001',
            country: 'IN',
          },
          packaging: 'Tray',
          totalAmount: new Prisma.Decimal('10.00'),
          kitchenReadyAt: input.kitchenReady ? new Date() : null,
        },
        select: { id: true },
      });
      orderIds.push(order.id);
      return order.id;
    };

    const sameAddressOrders = await Promise.all([
      createOrder({ companyId: companyAId, employeeId: employeeAId, addressLine1: '123 Main Street', recipientName: 'Recipient One', time: '12:00', kitchenReady: true }),
      createOrder({ companyId: companyAId, employeeId: employeeAId, addressLine1: ' 123   MAIN STREET ', recipientName: 'Recipient Two', time: '12:00', kitchenReady: true }),
      createOrder({ companyId: companyAId, employeeId: employeeAId, addressLine1: '123 Main Street', recipientName: 'Recipient Three', time: '12:00', kitchenReady: true }),
    ]);
    const differentAddressId = await createOrder({
      companyId: companyAId,
      employeeId: employeeAId,
      addressLine1: '9 Other Road',
      recipientName: 'Other Location',
      time: '12:00',
      kitchenReady: true,
    });
    const differentTimeId = await createOrder({
      companyId: companyAId,
      employeeId: employeeAId,
      addressLine1: '123 Main Street',
      recipientName: 'Late Slot',
      time: '12:30',
      kitchenReady: true,
    });
    const differentCompanyId = await createOrder({
      companyId: companyBId,
      employeeId: employeeBId,
      addressLine1: '123 Main Street',
      recipientName: 'Other Company',
      time: '12:00',
      kitchenReady: true,
    });
    const notReadyId = await createOrder({
      companyId: companyAId,
      employeeId: employeeAId,
      addressLine1: 'Not Ready Road',
      recipientName: 'Not Ready',
      time: '12:00',
      kitchenReady: false,
    });
    const cancelledId = await createOrder({
      companyId: companyAId,
      employeeId: employeeAId,
      addressLine1: 'Cancelled Road',
      recipientName: 'Cancelled',
      time: '12:00',
      kitchenReady: true,
      status: OrderStatus.CANCELLED,
    });

    const grouping = new DropGroupingService(prisma);
    const [firstRun, concurrentRun] = await Promise.all([
      grouping.groupReadyOrders(deliveryDate),
      grouping.groupReadyOrders(deliveryDate),
    ]);
    expect(firstRun.dropCount + concurrentRun.dropCount).toBe(4);
    const retryRun = await grouping.groupReadyOrders(deliveryDate);
    expect(retryRun.dropCount).toBe(0);

    const groupedOrders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: { id: true, deliveryDropId: true },
    });
    const groupForTriplet = groupedOrders
      .filter((order) => sameAddressOrders.includes(order.id))
      .map((order) => order.deliveryDropId);
    expect(new Set(groupForTriplet).size).toBe(1);
    expect(groupedOrders.find((order) => order.id === notReadyId)?.deliveryDropId).toBeNull();
    expect(groupedOrders.find((order) => order.id === cancelledId)?.deliveryDropId).toBeNull();
    expect(groupedOrders.find((order) => order.id === differentAddressId)?.deliveryDropId)
      .not.toBe(groupForTriplet[0]);
    expect(groupedOrders.find((order) => order.id === differentTimeId)?.deliveryDropId)
      .not.toBe(groupForTriplet[0]);
    expect(groupedOrders.find((order) => order.id === differentCompanyId)?.deliveryDropId)
      .not.toBe(groupForTriplet[0]);

    const companyBDropId = groupedOrders.find((order) => order.id === differentCompanyId)?.deliveryDropId;
    const companyBDrop = await prisma.deliveryDrop.findUniqueOrThrow({
      where: { id: companyBDropId! },
      select: { driverId: true },
    });
    expect(companyBDrop.driverId).toBeNull();

    const dropId = groupForTriplet[0]!;
    const originalDrop = await prisma.deliveryDrop.findUniqueOrThrow({
      where: { id: dropId },
      select: { status: true, driverId: true },
    });
    expect(originalDrop.status).toBe(DeliveryDropStatus.KITCHEN_READY);
    expect(originalDrop.driverId).toBe(companyA.defaultDriverId);

    const workflow = new DispatchWorkflowService(prisma);
    await workflow.assignDriver(dropId, { driverId: overrideDriverId! });
    const readyAttempts = await Promise.allSettled([
      workflow.markDispatchReady(dropId),
      workflow.markDispatchReady(dropId),
    ]);
    expect(readyAttempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);

    const outAttempts = await Promise.allSettled([
      workflow.startDelivery(dropId),
      workflow.startDelivery(dropId),
    ]);
    expect(outAttempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    const driverService = new DriverDropService(prisma);
    const previousDriverToday = await driverService.listToday(companyA.defaultDriverId!, new Date());
    const assignedDriverToday = await driverService.listToday(overrideDriverId!, new Date());
    expect(previousDriverToday.some((drop) => drop.id === dropId)).toBe(false);
    expect(assignedDriverToday.some((drop) => drop.id === dropId)).toBe(true);

    const deliveredAt = toIstDateTime(deliveryDate, '11:59');
    const deliveryAttempts = await Promise.allSettled([
      driverService.deliver(overrideDriverId!, dropId, {}, deliveredAt),
      driverService.deliver(overrideDriverId!, dropId, {}, deliveredAt),
    ]);
    expect(deliveryAttempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    const result = deliveryAttempts.find((attempt) => attempt.status === 'fulfilled');
    expect(result?.status).toBe('fulfilled');
    if (result?.status !== 'fulfilled') throw new Error('One delivery request should succeed');
    expect(result.value.onTime).toBe(true);
    const deliveredOrders = await prisma.order.findMany({
      where: { id: { in: sameAddressOrders } },
      select: { status: true, deliveredAt: true },
    });
    expect(deliveredOrders.every((order) => order.status === OrderStatus.DELIVERED)).toBe(true);
    expect(deliveredOrders.every((order) => order.deliveredAt?.getTime() === deliveredAt.getTime())).toBe(true);
  }, 30_000);
});