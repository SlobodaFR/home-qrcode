import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { applySecurityHeaders } from './interfaces/http/security-headers';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  // First middleware: every response (API, QR images, SPA files) gets the security headers.
  applySecurityHeaders(app, process.env['AUTH_BASE_URL']);

  // Number of reverse-proxy hops to trust for X-Forwarded-For (req.ip feeds the
  // rate limit). Production: 1 (Caddy, which drops client-sent X-Forwarded-For).
  // Unset in local dev, otherwise any client could spoof its IP.
  const trustProxyHops = Number(process.env['TRUST_PROXY_HOPS'] || 0);
  if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0) {
    throw new Error('TRUST_PROXY_HOPS must be a non-negative integer');
  }
  if (trustProxyHops > 0) {
    app.set('trust proxy', trustProxyHops);
  }

  app.setGlobalPrefix('api', { exclude: ['r/:id', 'q/:id', 'healthz'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.use(cookieParser());

  await app.listen(process.env['PORT'] ?? 3000);
}

void bootstrap();
