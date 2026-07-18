import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as request from 'supertest';
import { AppModule } from './app.module';

const DIST_PATH = path.join(__dirname, '..', '..', 'frontend', 'dist');

function ensureDistFixture(): void {
  if (!fs.existsSync(DIST_PATH)) {
    fs.mkdirSync(DIST_PATH, { recursive: true });
  }
  const indexPath = path.join(DIST_PATH, 'index.html');
  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(indexPath, '<!doctype html><html><body>test-spa</body></html>');
  }
}

describe('AppModule', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env['FRONTEND_URL'] = 'http://localhost:5173';
    ensureDistFixture();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['r/:id', 'q/:id'] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.use(cookieParser());

    // ServeStaticModule uses NoopLoader in @nestjs/testing (HTTP adapter not ready
    // during onModuleInit at compile time). Register static middleware manually here
    // before init() so it runs before NestJS routes — same order as in production.
    app.use(express.static(DIST_PATH));
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(DIST_PATH, 'index.html'));
    });

    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  // Task 17 — AppModule is valid
  it('should be a valid NestJS module', () => {
    expect(app).toBeDefined();
  });

  // Task 18 — ConfigModule loaded
  it('should boot with ConfigModule loaded', () => {
    expect(app.get(ConfigService)).toBeDefined();
  });

  // Task 19 — global prefix /api applied
  it('should return JSON 404 for GET /api/ (global prefix applied)', async () => {
    const res = await request(app.getHttpServer()).get('/api/');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
  });

  // Task 20 — /r/:id excluded from prefix (served by SPA fallback, not /api/r/:id)
  it('should serve SPA for GET /r/test-id (excluded from /api prefix)', async () => {
    const res = await request(app.getHttpServer()).get('/r/test-id');
    expect(res.status).toBe(200);
  });

  // Task 21 — /q/:id excluded from prefix
  it('should serve SPA for GET /q/test-id (excluded from /api prefix)', async () => {
    const res = await request(app.getHttpServer()).get('/q/test-id');
    expect(res.status).toBe(200);
  });

  // Task 22 — SPA served at /
  it('should serve SPA index.html for GET /', async () => {
    const res = await request(app.getHttpServer()).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('test-spa');
  });

  // Task 23 — SPA catch-all
  it('should serve SPA for any unknown path (SPA fallback)', async () => {
    const res = await request(app.getHttpServer()).get('/some/unknown/path');
    expect(res.status).toBe(200);
  });

  // Task 24 — /api/* not swallowed by SPA
  it('should return JSON 404 for GET /api/nonexistent (not SPA)', async () => {
    const res = await request(app.getHttpServer()).get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
  });
});
