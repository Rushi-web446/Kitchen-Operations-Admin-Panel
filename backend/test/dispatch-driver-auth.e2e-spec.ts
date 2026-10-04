import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { hash } from 'bcryptjs';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AuthModule } from '../src/auth/auth.module';
import { DatabaseModule } from '../src/database/database.module';
import { PrismaService } from '../src/database/prisma.service';
import { DispatchBoardService } from '../src/dispatch/dispatch-board.service';
import { DispatchController } from '../src/dispatch/dispatch.controller';
import { DispatchWorkflowService } from '../src/dispatch/dispatch-workflow.service';
import { DropGroupingService } from '../src/dispatch/drop-grouping.service';
import { DriverController } from '../src/driver/driver.controller';
import { DriverDropService } from '../src/driver/driver-drop.service';

const secret = 'dispatch-driver-e2e-secret-long-enough';
const password = 'Dispatch@123';
const users = [
  { id: 1, email: 'admin@dispatch-test.invalid', role: Role.ADMIN },
  { id: 2, email: 'kitchen@dispatch-test.invalid', role: Role.KITCHEN },
  { id: 3, email: 'dispatch@dispatch-test.invalid', role: Role.DISPATCH },
  { id: 4, email: 'driver@dispatch-test.invalid', role: Role.DRIVER },
];

describe('Dispatch and Driver authorization (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const passwordHash = hash(password, 4);
  const prismaMock = {
    user: {
      findUnique: vi.fn(async (args: { where: { id?: number; email?: string } }) => {
        const user = users.find(
          (candidate) => candidate.id === args.where.id || candidate.email === args.where.email,
        );
        return user
          ? {
              ...user,
              name: user.role,
              passwordHash: await passwordHash,
              driver: user.role === Role.DRIVER ? { id: 88, companyId: 7 } : null,
            }
          : null;
      }),
    },
  };
  const dispatchBoard = { list: vi.fn(async () => []) };
  const dispatchWorkflow = {
    assignDriver: vi.fn(async () => ({})),
    markDispatchReady: vi.fn(async () => ({})),
    startDelivery: vi.fn(async () => ({})),
  };
  const grouping = { groupReadyOrders: vi.fn(async () => ({})) };
  const driverDrops = { listToday: vi.fn(async () => []), deliver: vi.fn(async () => ({})) };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ JWT_SECRET: secret, JWT_EXPIRES_IN: '1h', NODE_ENV: 'test' })],
        }),
        DatabaseModule,
        AuthModule,
      ],
      controllers: [DispatchController, DriverController],
      providers: [
        { provide: DispatchBoardService, useValue: dispatchBoard },
        { provide: DispatchWorkflowService, useValue: dispatchWorkflow },
        { provide: DropGroupingService, useValue: grouping },
        { provide: DriverDropService, useValue: driverDrops },
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function loginAs(role: Role) {
    const user = users.find((candidate) => candidate.role === role)!;
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/auth/login').send({ email: user.email, password }).expect(200);
    return agent;
  }

  it('requires authentication and separates Dispatch from Driver endpoints', async () => {
    await request(app.getHttpServer()).get('/api/dispatch/drops').expect(401);
    await request(app.getHttpServer()).get('/api/driver/drops/today').expect(401);

    const dispatch = await loginAs(Role.DISPATCH);
    await dispatch.get('/api/dispatch/drops').expect(200);
    await dispatch.get('/api/driver/drops/today').expect(403);

    const driver = await loginAs(Role.DRIVER);
    await driver.get('/api/driver/drops/today').expect(200);
    await driver.get('/api/dispatch/drops').expect(403);

    const kitchen = await loginAs(Role.KITCHEN);
    await kitchen.get('/api/dispatch/drops').expect(403);
    await kitchen.get('/api/driver/drops/today').expect(403);
  });

  it('derives the driver ID from the authenticated identity', async () => {
    const driver = await loginAs(Role.DRIVER);
    await driver.get('/api/driver/drops/today').expect(200);
    expect(driverDrops.listToday).toHaveBeenCalledWith(88);
  });

  it('rejects driver-id spoofing fields', async () => {
    const driver = await loginAs(Role.DRIVER);
    await driver
      .post('/api/driver/drops/10/deliver')
      .send({ driverId: 7 })
      .expect(400);
  });

  it('rejects non-dispatch users on status and assignment operations', async () => {
    const driver = await loginAs(Role.DRIVER);
    await driver.post('/api/dispatch/drops/10/ready').expect(403);
    await driver.post('/api/dispatch/drops/10/out-for-delivery').expect(403);
    await driver.post('/api/dispatch/drops/10/assign-driver').send({ driverId: 88 }).expect(403);

    const dispatch = await loginAs(Role.DISPATCH);
    await dispatch.post('/api/dispatch/drops/10/ready').expect(201);
    await dispatch.post('/api/dispatch/drops/10/out-for-delivery').expect(201);
    await dispatch.post('/api/dispatch/drops/10/assign-driver').send({ driverId: 88 }).expect(201);
  });
});