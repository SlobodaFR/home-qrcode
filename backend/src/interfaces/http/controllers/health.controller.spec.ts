import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { RuntimeHealthMonitor } from '../../../infrastructure/observability/runtime-health.monitor';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { HealthController } from './health.controller';

describe('GET /healthz', () => {
  let app: NestExpressApplication;
  const monitor: { lastSample: unknown } = { lastSample: null };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: RuntimeHealthMonitor, useValue: monitor }],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('answers ok with no runtime data before the first sample', async () => {
    monitor.lastSample = null;

    const response = await request(app.getHttpServer())
      .get('/healthz')
      .expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      version: 'dev',
      commit: 'dev',
      runtime: null,
    });
  });

  it('exposes the last runtime sample', async () => {
    const sample = {
      lag_p50_ms: 1,
      lag_p99_ms: 3,
      lag_max_ms: 5,
      elu: 0.1,
      heap_used_mb: 40,
      rss_mb: 90,
    };
    monitor.lastSample = sample;

    const response = await request(app.getHttpServer())
      .get('/healthz')
      .expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      version: 'dev',
      commit: 'dev',
      runtime: sample,
    });
  });

  it('is public (no session) and not rate limited, since Caddy hides it from the internet', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, HealthController)).toBe(true);
    expect(Reflect.getMetadata('THROTTLER:SKIPdefault', HealthController)).toBe(
      true,
    );
  });
});
