import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../database/prisma.service';
import { ACCESS_TOKEN_COOKIE } from '../auth.constants';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request: Request) => request.cookies?.[ACCESS_TOKEN_COOKIE] ?? null,
        (request: Request) => {
          const header = request.headers?.['x-access-token'];
          if (typeof header === 'string') return header;
          if (Array.isArray(header) && header.length > 0) return header[0];
          return null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const userId = Number(payload?.sub);
    if (
      !Number.isSafeInteger(userId) ||
      userId < 1 ||
      typeof payload.email !== 'string' ||
      !Object.values(Role).includes(payload.role)
    ) {
      throw new UnauthorizedException();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        driver: { select: { id: true, companyId: true } },
      },
    });

    if (!user || user.email !== payload.email) {
      throw new UnauthorizedException();
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      ...(user.driver && {
        driverId: user.driver.id,
        companyId: user.driver.companyId,
      }),
    };
  }
}