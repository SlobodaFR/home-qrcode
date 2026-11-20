import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { applySecurityHeaders } from './interfaces/http/security-headers';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // First middleware: every response (API, QR images, SPA files) gets the security headers.
  applySecurityHeaders(app, process.env['AUTH_BASE_URL']);

  app.setGlobalPrefix('api', { exclude: ['r/:id', 'q/:id'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.use(cookieParser());

  await app.listen(process.env['PORT'] ?? 3000);
}

void bootstrap();
