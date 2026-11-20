import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Controller, Get } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { applySecurityHeaders } from './security-headers';

@Controller()
class StubController {
  @Get('ping')
  ping(): string {
    return 'pong';
  }
}

describe('security headers', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const publicDir = mkdtempSync(join(tmpdir(), 'spa-'));
    writeFileSync(join(publicDir, 'index.html'), '<html></html>');
    const moduleRef = await Test.createTestingModule({
      controllers: [StubController],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    applySecurityHeaders(app, 'https://auth.example.test/some/path');
    app.useStaticAssets(publicDir);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const expectStrictHeaders = (headers: Record<string, string>) => {
    const csp = headers['content-security-policy'];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("style-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain(
      "img-src 'self' data: https://auth.example.test https://ui-avatars.com",
    );
    expect(headers['strict-transport-security']).toBe(
      'max-age=31536000; includeSubDomains',
    );
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
  };

  it('protects API responses', async () => {
    const response = await request(app.getHttpServer()).get('/ping');
    expect(response.status).toBe(200);
    expectStrictHeaders(response.headers);
  });

  it('protects the SPA static files', async () => {
    const response = await request(app.getHttpServer()).get('/index.html');
    expect(response.status).toBe(200);
    expectStrictHeaders(response.headers);
  });

  it('keeps the CSP when the auth base URL is missing or invalid', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [StubController],
    }).compile();
    const other = moduleRef.createNestApplication<NestExpressApplication>();
    applySecurityHeaders(other, 'not a url');
    await other.init();
    const response = await request(other.getHttpServer()).get('/ping');
    expect(response.headers['content-security-policy']).toContain(
      "img-src 'self' data: https://ui-avatars.com",
    );
    await other.close();
  });
});
