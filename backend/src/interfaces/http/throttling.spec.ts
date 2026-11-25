import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { HandleOAuthCallbackUseCase } from '../../application/auth/handle-oauth-callback.use-case';
import { InitiateServiceLogoutUseCase } from '../../application/auth/initiate-service-logout.use-case';
import { HandleSessionRevokedUseCase } from '../../application/auth/handle-session-revoked.use-case';
import { RedirectUseCase } from '../../application/redirect/redirect.use-case';
import { OAuthClient } from '../../domain/auth/oauth-client';
import { FeatureFlags } from '../../domain/shared/feature-flags';
import { UserRepository } from '../../domain/user/user.repository';
import { AuthController } from './controllers/auth.controller';
import { RedirectController } from './controllers/redirect.controller';
import { QrController } from './controllers/qr.controller';
import { THROTTLE_ERROR_MESSAGE, throttlerOptions } from './throttling';

describe('Rate limiting (HTTP)', () => {
  let app: NestExpressApplication;

  async function createApp(
    trustProxyHops: number,
  ): Promise<NestExpressApplication> {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(throttlerOptions)],
      controllers: [AuthController, RedirectController],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        {
          provide: RedirectUseCase,
          useValue: {
            execute: vi
              .fn<RedirectUseCase['execute']>()
              .mockResolvedValue({ targetUrl: 'https://target.example.test' }),
          },
        },
        {
          provide: OAuthClient,
          useValue: {
            authorizeUrl: vi
              .fn<OAuthClient['authorizeUrl']>()
              .mockReturnValue('https://auth.example.test/authorize'),
          },
        },
        { provide: HandleOAuthCallbackUseCase, useValue: {} },
        { provide: HandleSessionRevokedUseCase, useValue: {} },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn<(key: string) => unknown>(),
            getOrThrow: vi
              .fn<(key: string) => unknown>()
              .mockReturnValue('https://qrcode.example.test'),
          },
        },
        { provide: UserRepository, useValue: {} },
        { provide: FeatureFlags, useValue: {} },
        { provide: InitiateServiceLogoutUseCase, useValue: {} },
      ],
    }).compile();

    const nestApp = moduleRef.createNestApplication<NestExpressApplication>();
    nestApp.setGlobalPrefix('api', { exclude: ['r/:id', 'q/:id'] });
    if (trustProxyHops > 0) {
      nestApp.set('trust proxy', trustProxyHops);
    }
    await nestApp.init();
    return nestApp;
  }

  afterEach(async () => {
    await app.close();
  });

  const login = (ip: string) =>
    request(app.getHttpServer())
      .get('/api/auth/login')
      .set('X-Forwarded-For', ip);

  it('answers 429 after 30 login attempts per minute from one IP, other IPs are unaffected', async () => {
    app = await createApp(1);
    for (let i = 0; i < 30; i++) {
      await login('203.0.113.1').expect(302);
    }

    const blocked = await login('203.0.113.1').expect(429);
    expect(blocked.body).toMatchObject({
      statusCode: 429,
      message: THROTTLE_ERROR_MESSAGE,
    });
    expect(blocked.headers['retry-after']).toBeDefined();

    await login('203.0.113.2').expect(302);
  });

  it('never throttles the public redirect used by scanned QR codes', async () => {
    app = await createApp(1);
    for (let i = 0; i < 150; i++) {
      await request(app.getHttpServer())
        .get('/r/qr-1')
        .set('X-Forwarded-For', '203.0.113.9')
        .expect(302);
    }
  });

  it('groups IPv6 clients by /64', async () => {
    app = await createApp(1);
    for (let i = 0; i < 30; i++) {
      await login(`2001:db8:1:2::${i.toString(16)}`).expect(302);
    }

    expect((await login('2001:db8:1:2:ffff::1')).status).toBe(429);
    expect((await login('2001:db8:1:3::1')).status).toBe(302);
  });

  it('ignores X-Forwarded-For when no proxy is trusted', async () => {
    app = await createApp(0);
    for (let i = 0; i < 30; i++) {
      await login(`198.51.100.${String(i)}`).expect(302);
    }

    expect((await login('198.51.100.200')).status).toBe(429);
  });

  describe('routes exempt from the default budget', () => {
    const isSkipped = (handler: object): boolean =>
      Reflect.getMetadata('THROTTLER:SKIPdefault', handler) === true;

    it.each(['getMeta', 'streamPng', 'streamSvg', 'streamLogo'] as const)(
      'does not throttle the public read-only QR route %s',
      (name) => {
        expect(isSkipped(QrController.prototype[name])).toBe(true);
      },
    );

    it('does not throttle the secret-gated home-auth webhook', () => {
      expect(isSkipped(AuthController.prototype.disconnect)).toBe(true);
    });

    it('applies the stricter budget to QR creation and logo upload', () => {
      expect(
        Reflect.getMetadata(
          'THROTTLER:LIMITdefault',
          QrController.prototype.create,
        ),
      ).toBe(30);
      expect(
        Reflect.getMetadata(
          'THROTTLER:LIMITdefault',
          QrController.prototype.attachLogoEndpoint,
        ),
      ).toBe(30);
    });
  });
});
