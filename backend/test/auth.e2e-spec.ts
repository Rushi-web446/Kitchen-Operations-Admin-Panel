import {
  Controller,
  Get,
  INestApplication,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { hash } from 'bcryptjs';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AuthModule } from '../src/auth/auth.module';
import { ACCESS_TOKEN_COOKIE } from '../src/auth/auth.constants';
import { CurrentUser } from '../src/auth/decorators/current-user.decorator';
import { Roles } from '../src/auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../src/auth/interfaces/authenticated-user.interface';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import { DatabaseModule } from '../src/database/database.module';
import { PrismaService } from '../src/database/prisma.service';

const TEST_JWT_SECRET = 'auth-e2e-only-secret-that-is-long-enough';
const TEST_PASSWORD = 'Test@1234';
const testUsers = [
  { id: 1, email: 'admin@test.com', role: Role.ADMIN, name: 'Admin' },
  { id: 2, email: 'kitchen@test.com', role: Role.KITCHEN, name: 'Kitchen' },
  { id: 3, email: 'dispatch@test.com', role: Role.DISPATCH, name: 'Dispatch' },
  { id: 4, email: 'driver@test.com', role: Role.DRIVER, name: 'Driver' },
];

@Controller('auth-test')
class AuthRbacProbeController {
  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  admin(@CurrentUser() user: AuthenticatedUser) {
    return { role: user.role };
  }

  @Get('kitchen')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.KITCHEN)
  kitchen(@CurrentUser() user: AuthenticatedUser) {
    return { role: user.role };
  }

  @Get('dispatch')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DISPATCH)
  dispatch(@CurrentUser() user: AuthenticatedUser) {
    return { role: user.role };
  }

  @Get('driver')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DRIVER)
  driver(@CurrentUser() user: AuthenticatedUser) {
    return { role: user.role };
  }
}

describe('Authentication and authorization (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  const passwordHash = hash(TEST_PASSWORD, 4);

  const prismaMock = {
    user: {
      findUnique: vi.fn(async (args: { where: { id?: number; email?: string } }) => {
        const user = testUsers.find(
          (candidate) =>
            candidate.id === args.where.id || candidate.email === args.where.email,
        );
        if (!user) return null;

        return {
          ...user,
          passwordHash: await passwordHash,
          driver: user.role === Role.DRIVER ? { id: 44, companyId: 12 } : null,
        };
      }),
    },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              JWT_SECRET: TEST_JWT_SECRET,
              JWT_EXPIRES_IN: '1h',
              NODE_ENV: 'test',
            }),
          ],
        }),
        DatabaseModule,
        AuthModule,
      ],
      controllers: [AuthRbacProbeController],
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
    jwtService = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('logs in with valid credentials and returns no password data', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: TEST_PASSWORD })
      .expect(200);

    expect(response.body).toEqual({ id: 1, email: 'admin@test.com', role: Role.ADMIN });
    expect(response.body).not.toHaveProperty('passwordHash');
    expect(response.body).not.toHaveProperty('password');
    expect(response.headers['set-cookie'][0]).toContain(`${ACCESS_TOKEN_COOKIE}=`);
    expect(response.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
    expect(response.headers['set-cookie'][0]).toMatch(/SameSite=Lax/i);
  });

  it.each([
    ['unknown email', 'nobody@test.com', TEST_PASSWORD],
    ['wrong password', 'admin@test.com', 'wrong-password'],
  ])('rejects %s with the same generic response', async (_case, email, password) => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(401);

    expect(response.body.message).toBe('Invalid email or password');
  });

  it('rejects malformed emails and unknown request fields', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: TEST_PASSWORD })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: TEST_PASSWORD, role: Role.ADMIN })
      .expect(400);
  });

  it('requires a valid cookie token and returns the current database identity', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'driver@test.com', password: TEST_PASSWORD })
      .expect(200);
    const cookie = login.headers['set-cookie'][0].split(';')[0];

    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', cookie)
      .expect(200);

    expect(response.body).toEqual({ id: 4, email: 'driver@test.com', role: Role.DRIVER });
    expect(response.body).not.toHaveProperty('passwordHash');
  });

  it('rejects invalid and expired JWTs', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', `${ACCESS_TOKEN_COOKIE}=not-a-jwt`)
      .expect(401);

    const expiredToken = await jwtService.signAsync(
      { sub: '1', email: 'admin@test.com', role: Role.ADMIN },
      { expiresIn: -1 },
    );
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', `${ACCESS_TOKEN_COOKIE}=${expiredToken}`)
      .expect(401);
  });

  it('uses the current role from the database instead of the JWT role claim', async () => {
    const token = await jwtService.signAsync({
      sub: '1',
      email: 'admin@test.com',
      role: Role.DRIVER,
    });
    const cookie = `${ACCESS_TOKEN_COOKIE}=${token}`;

    await request(app.getHttpServer())
      .get('/api/auth-test/admin')
      .set('Cookie', cookie)
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/auth-test/driver')
      .set('Cookie', cookie)
      .expect(403);
  });

  it('clears the auth cookie on logout and rejects /me afterward', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: TEST_PASSWORD })
      .expect(200);

    const logout = await agent.post('/api/auth/logout').expect(200);
    expect(logout.headers['set-cookie'][0]).toMatch(/Max-Age=0|Expires=/i);
    await agent.get('/api/auth/me').expect(401);
  });

  it.each(testUsers)('$role may access only its matching protected route', async (user) => {
    const token = await jwtService.signAsync({
      sub: String(user.id),
      email: user.email,
      role: user.role,
    });
    const cookie = `${ACCESS_TOKEN_COOKIE}=${token}`;
    const routes: Array<[Role, string]> = [
      [Role.ADMIN, 'admin'],
      [Role.KITCHEN, 'kitchen'],
      [Role.DISPATCH, 'dispatch'],
      [Role.DRIVER, 'driver'],
    ];

    for (const [requiredRole, route] of routes) {
      const expectedStatus = user.role === requiredRole ? 200 : 403;
      await request(app.getHttpServer())
        .get(`/api/auth-test/${route}`)
        .set('Cookie', cookie)
        .expect(expectedStatus);
    }
  });
});