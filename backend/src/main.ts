import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { AppModule } from './app.module';

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

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const allowedOrigins = parseAllowedOrigins(config);

  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
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