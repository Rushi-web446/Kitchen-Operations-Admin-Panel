import {
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { hash } from 'bcryptjs';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AuthModule } from '../src/auth/auth.module';
import { DatabaseModule } from '../src/database/database.module';
import { PrismaService } from '../src/database/prisma.service';
import { KitchenBoardService } from '../src/kitchen/kitchen-board.service';
import { KitchenController } from '../src/kitchen/kitchen.controller';
import { KitchenUnitWorkflowService } from '../src/kitchen/kitchen-unit-workflow.service';

const testPassword = 'KitchenE2E@123';
const roles = [Role.ADMIN, Role.KITCHEN, Role.DISPATCH, Role.DRIVER];
const users = roles.map((role, index) => ({
  id: index + 1,
  role,
  email: `${role.toLowerCase()}@kitchen-test.invalid`,
}));

describe('Kitchen authorization (e2e)', () => {
  let app: INestApplication;
  const passwordHash = hash(testPassword, 4);
  const prismaMock = {
    user: {
      findUnique: vi.fn(async (args: { where: { id?: number; email?: string } }) => {
        const user = users.find(
          (candidate) =>
            candidate.id === args.where.id || candidate.email === args.where.email,
        );
        return user
          ? {
              ...user,
              name: user.role,
              passwordHash: await passwordHash,
              driver: null,
            }
          : null;
      }),
    },
  };
  const board = { list: vi.fn(async () => []) };
  const workflow = {
    start: vi.fn(async (id: number) => ({ id, status: 'STARTED' })),
    complete: vi.fn(async (id: number) => ({ id, status: 'DONE' })),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              JWT_SECRET: 'kitchen-e2e-secret-long-enough-for-hmac',
              JWT_EXPIRES_IN: '1h',
              NODE_ENV: 'test',
            }),
          ],
        }),
        DatabaseModule,
        AuthModule,
      ],
      controllers: [KitchenController],
      providers: [
        { provide: KitchenBoardService, useValue: board },
        { provide: KitchenUnitWorkflowService, useValue: workflow },
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires authentication for Kitchen operations', async () => {
    await request(app.getHttpServer()).get('/api/kitchen/orders').expect(401);
    await request(app.getHttpServer()).post('/api/kitchen/units/12/start').expect(401);
    await request(app.getHttpServer()).post('/api/kitchen/units/12/done').expect(401);
  });

  it.each(roles)('%s is denied Kitchen endpoints unless role is KITCHEN', async (role) => {
    const user = users.find((candidate) => candidate.role === role)!;
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/login')
      .send({ email: user.email, password: testPassword })
      .expect(200);

    const expected = role === Role.KITCHEN ? 200 : 403;
    await agent.get('/api/kitchen/orders').expect(expected);
    await agent.post('/api/kitchen/units/12/start').expect(role === Role.KITCHEN ? 201 : 403);
    await agent.post('/api/kitchen/units/12/done').expect(role === Role.KITCHEN ? 201 : 403);
  });

  it('passes dashboard filters through to the board service', async () => {
    const kitchen = users.find((user) => user.role === Role.KITCHEN)!;
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/login')
      .send({ email: kitchen.email, password: testPassword })
      .expect(200);

    await agent
      .get('/api/kitchen/orders?deliveryDate=2026-10-03&kitchenStation=GRILL')
      .expect(200);
    expect(board.list).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryDate: '2026-10-03',
        kitchenStation: 'GRILL',
      }),
    );
  });
});