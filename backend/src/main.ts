import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { AppModule } from './app.module';

function normalizeOrigin(value: string): string {
  return value
    .trim()
    .replace(/\/+$/, '')
    .replace(/^([a-z]+:\/\/)(www\.)?/i, (_m, scheme) => scheme)
    .toLowerCase();
}

function parseAllowedOrigins(config: ConfigService): string[] {
  const urls = config.get<string>('FRONTEND_URLS') ?? config.get<string>('FRONTEND_URL');
  const defaults = ['http://localhost:3000', 'http://127.0.0.1:3000'];
  if (!urls) return defaults;
  const parsed = urls
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);
  return [...new Set([...parsed, ...defaults])];
}

function originIsAllowed(requestOrigin: string | undefined, allowedOrigins: string[]): boolean {
  if (!requestOrigin) return true;
  const normalizedRequest = normalizeOrigin(requestOrigin);
  for (const allowed of allowedOrigins) {
    if (normalizeOrigin(allowed) === normalizedRequest) return true;
    if (allowed.endsWith('.vercel.app')) {
      const host = normalizeOrigin(allowed).replace(/^https?:\/\//, '');
      const requestHost = normalizedRequest.replace(/^https?:\/\//, '');
      if (requestHost === host || requestHost.endsWith('.' + host)) return true;
    }
    try {
      const reqUrl = new URL(requestOrigin);
      const allowedUrl = new URL(allowed);
      if (reqUrl.hostname === 'localhost' || reqUrl.hostname === '127.0.0.1') {
        if (allowedUrl.hostname === 'localhost' || allowedUrl.hostname === '127.0.0.1') {
          return reqUrl.protocol === allowedUrl.protocol && (!allowedUrl.port || reqUrl.port === allowedUrl.port);
        }
      }
    } catch {
      /* malformed — ignore */
    }
  }
  return false;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const allowedOrigins = parseAllowedOrigins(config);

  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      if (originIsAllowed(origin, allowedOrigins)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  };

  app.use(cookieParser());
  app.enableCors(corsOptions);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  await app.listen(config.get<number>('PORT', 3001));
}

bootstrap();