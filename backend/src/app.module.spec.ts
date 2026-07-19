import { INestApplication, ValidationPipe } from '@nestjs/common';
import { QrCode } from './domain/qr/qr-code';
import { QrRepository } from './domain/qr/qr.repository';
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
    process.env['AUTH_BASE_URL'] = 'https://auth.example.com';
    process.env['AUTH_CLIENT_ID'] = 'test-client-id';
    process.env['AUTH_CLIENT_SECRET'] = 'test-client-secret';
    process.env['AUTH_WEBHOOK_SECRET'] = 'test-webhook-secret';
    process.env['DATABASE_PATH'] = ':memory:';
    process.env['MINIO_ENDPOINT'] = 'http://localhost:9000';
    process.env['MINIO_BUCKET'] = 'test-bucket';
    process.env['MINIO_ACCESS_KEY_ID'] = 'minioadmin';
    process.env['MINIO_SECRET_ACCESS_KEY'] = 'minioadmin';
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
      if (req.path.startsWith('/r/')) return next();
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

  // Task 20 — /r/:id excluded from prefix (handled by RedirectController, not /api/r/:id)
  it('should return 404 on GET /r/nonexistent (RedirectController owns the route, not SPA)', async () => {
    const res = await request(app.getHttpServer()).get('/r/nonexistent');
    expect(res.status).toBe(404);
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
    expect(res.headers['content-type']).toMatch(/html/);
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

  // Test 32 — AppModule boots with DatabaseModule + AuthModule
  it('should boot AppModule with DatabaseModule and AuthModule registered', () => {
    expect(app).toBeDefined();
    // AuthModule registers APP_GUARD globally — the app initialised without error
  });

  // Test 33 — login redirects to AUTH_BASE_URL/authorize
  it('should return 302 to AUTH_BASE_URL/authorize on GET /api/auth/login', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/login');
    expect(res.status).toBe(302);
    expect(res.headers['location']).toContain('auth.example.com/authorize');
  });

  // Test 34 — protected endpoint returns 401 without cookies
  it('should return 401 on a protected endpoint without auth cookies', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  // Test 35 — logout returns 204
  it('should return 204 on POST /api/auth/logout', async () => {
    const res = await request(app.getHttpServer()).post('/api/auth/logout');
    expect(res.status).toBe(204);
  });

  // Test 40 — POST /api/qr without auth → 401
  it('should return 401 on POST /api/qr without auth cookies', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/qr')
      .send({ contentType: 'text', content: 'Hello' });
    expect(res.status).toBe(401);
  });

  // Test 41 — GET /api/qr/:id/png unknown id → 404 (public route)
  it('should return 404 on GET /api/qr/nonexistent/png (public route, missing QR)', async () => {
    const res = await request(app.getHttpServer()).get('/api/qr/nonexistent/png');
    expect(res.status).toBe(404);
  });

  // Test 28 — GET /r/{id} url-type QR → 302 with Location header
  it('should return 302 with Location header on GET /r/{id} for a url-type QR', async () => {
    const qrRepo = app.get(QrRepository);
    const qr = QrCode.create({
      id: 'e2e-redirect-1', userId: 'user-e2e', contentType: 'url',
      content: 'https://target.sloboda.fr', size: 1024, fgColor: '#000000',
      bgColor: '#FFFFFF', errorCorrection: 'M', createdAt: new Date(),
    });
    await qrRepo.save(qr);
    const res = await request(app.getHttpServer()).get('/r/e2e-redirect-1');
    expect(res.status).toBe(302);
    expect(res.headers['location']).toBe('https://target.sloboda.fr');
  });

  // Test 29 — GET /r/{id} unknown id → 404
  it('should return 404 on GET /r/unknown (no matching QR)', async () => {
    const res = await request(app.getHttpServer()).get('/r/unknown-e2e');
    expect(res.status).toBe(404);
  });

  // Test 30 — GET /r/{id} public, no auth needed
  it('should return 302 without auth cookies on GET /r/{id} (public route)', async () => {
    const qrRepo = app.get(QrRepository);
    const qr = QrCode.create({
      id: 'e2e-redirect-2', userId: 'user-e2e', contentType: 'url',
      content: 'https://public.sloboda.fr', size: 1024, fgColor: '#000000',
      bgColor: '#FFFFFF', errorCorrection: 'M', createdAt: new Date(),
    });
    await qrRepo.save(qr);
    const res = await request(app.getHttpServer())
      .get('/r/e2e-redirect-2');
    expect(res.status).toBe(302);
  });

  // Test 31 — PATCH /api/qr/:id without auth → 401
  it('should return 401 on PATCH /api/qr/:id without auth cookies', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/qr/some-id')
      .send({ content: 'https://new.com' });
    expect(res.status).toBe(401);
  });

  // Group 9 — Test 31 (tasks): GET /api/qr without auth → 401
  it('should return 401 on GET /api/qr without auth cookies', async () => {
    const res = await request(app.getHttpServer()).get('/api/qr');
    expect(res.status).toBe(401);
  });

  // Group 9 — Test 32: DELETE /api/qr/:id without auth → 401
  it('should return 401 on DELETE /api/qr/:id without auth cookies', async () => {
    const res = await request(app.getHttpServer()).delete('/api/qr/some-id');
    expect(res.status).toBe(401);
  });

  // Group 9 — Test 33: GET /r/{id} after DELETE → 404 (redirect route, unauthenticated)
  it('should return 404 on GET /r/{id} after QR is deleted', async () => {
    const qrRepo = app.get(QrRepository);
    const qr = QrCode.create({
      id: 'e2e-delete-redirect', userId: 'user-e2e', contentType: 'url',
      content: 'https://delete-test.sloboda.fr', size: 1024, fgColor: '#000000',
      bgColor: '#FFFFFF', errorCorrection: 'M', createdAt: new Date(),
    });
    await qrRepo.save(qr);
    await qrRepo.deleteById('e2e-delete-redirect', 'user-e2e');
    const res = await request(app.getHttpServer()).get('/r/e2e-delete-redirect');
    expect(res.status).toBe(404);
  });

  // Group 9 — Test 34: GET /api/qr/:id/png after DELETE → 404 (public proxy, DB check first)
  it('should return 404 on GET /api/qr/:id/png after QR is deleted', async () => {
    const qrRepo = app.get(QrRepository);
    const qr = QrCode.create({
      id: 'e2e-delete-png', userId: 'user-e2e', contentType: 'url',
      content: 'https://delete-png-test.sloboda.fr', size: 1024, fgColor: '#000000',
      bgColor: '#FFFFFF', errorCorrection: 'M', createdAt: new Date(),
    });
    await qrRepo.save(qr);
    await qrRepo.deleteById('e2e-delete-png', 'user-e2e');
    const res = await request(app.getHttpServer()).get('/api/qr/e2e-delete-png/png');
    expect(res.status).toBe(404);
  });
});
