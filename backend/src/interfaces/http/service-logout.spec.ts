import { ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AccessTokenVerifier } from '../../domain/auth/access-token-verifier';
import { OAuthClient, TokenPair } from '../../domain/auth/oauth-client';
import { FeatureFlagsModule } from '../../infrastructure/feature-flags/feature-flags.module';
import { UserOrmEntity } from '../../infrastructure/persistence/entities/user.orm-entity';
import { RevokedSessionOrmEntity } from '../../infrastructure/persistence/entities/revoked-session.orm-entity';
import { AuthModule } from './modules/auth.module';
import { serializedTypeOrmRoot } from '../../test-support/serialized-typeorm';

const FRONTEND = 'https://qrcode.example.test';
const AUTH = 'https://auth.example.test';
const PIN = 'FEATURES_PIN_AUTH_RP_INITIATED_LOGOUT';

describe('service-initiated logout (PC10): POST /auth/logout and GET /auth/logged-out', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  async function boot(
    options: {
      flag?: boolean;
      validTokens?: string[];
      refresh?: () => Promise<TokenPair>;
    } = {},
  ): Promise<NestExpressApplication> {
    delete process.env.FEATURES_OFREP_URL;
    delete process.env.FEATURES_API_KEY;
    delete process.env[PIN];
    if (options.flag !== undefined) process.env[PIN] = String(options.flag);
    const validTokens = options.validTokens ?? [];
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              AUTH_BASE_URL: AUTH,
              AUTH_CLIENT_ID: 'home-qrcode',
              AUTH_CLIENT_SECRET: 'client-secret',
              AUTH_WEBHOOK_SECRET: 'legacy',
              FRONTEND_URL: FRONTEND,
              NODE_ENV: 'production',
            }),
          ],
        }),
        serializedTypeOrmRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [UserOrmEntity, RevokedSessionOrmEntity],
          synchronize: true,
        }),
        FeatureFlagsModule,
        AuthModule,
      ],
    })
      .overrideProvider(AccessTokenVerifier)
      .useValue({
        verify: async (token: string) =>
          validTokens.includes(token)
            ? { sub: 'u1', email: 'e', name: 'n', issuedAt: new Date() }
            : null,
      })
      .overrideProvider(OAuthClient)
      .useValue({
        refresh:
          options.refresh ??
          (() => Promise.reject(new Error('refresh failed'))),
        logoutUrl: ({
          postLogoutRedirectUri,
          state,
          accessTokenHint,
        }: {
          postLogoutRedirectUri: string;
          state: string;
          accessTokenHint?: string;
        }) => {
          const url = new URL('/logout', AUTH);
          url.searchParams.set('client_id', 'home-qrcode');
          url.searchParams.set(
            'post_logout_redirect_uri',
            postLogoutRedirectUri,
          );
          url.searchParams.set('state', state);
          if (accessTokenHint)
            url.searchParams.set('access_token_hint', accessTokenHint);
          return url.toString();
        },
      })
      .compile();
    const app = moduleRef.createNestApplication<NestExpressApplication>();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    return app;
  }

  const logout = (app: NestExpressApplication, cookies: string[] = []) =>
    request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Sec-Fetch-Site', 'same-origin')
      .set('Cookie', cookies);

  function redirectOf(res: request.Response): string {
    return (res.body as { redirect_to: string }).redirect_to;
  }

  function setCookies(res: request.Response): string[] {
    return res.headers['set-cookie'] as unknown as string[];
  }

  function stateCookie(res: request.Response): string {
    const line = setCookies(res).find(
      (c) => c.startsWith('logout_state=') && !c.startsWith('logout_state=;'),
    );
    return line!.split(';')[0].split('=')[1];
  }

  it('flag off: local-only logout, redirect_to null, cookies cleared, no state cookie, no refresh attempted', async () => {
    const app = await boot({ flag: false, validTokens: ['a'] });
    try {
      const res = await logout(app, [
        'access_token=a',
        'refresh_token=r',
      ]).expect(200);
      expect(res.body).toEqual({ redirect_to: null });
      expect(res.headers['cache-control']).toBe('no-store');
      const cookies = setCookies(res).join('\n');
      expect(cookies).toMatch(/access_token=;/);
      expect(cookies).toMatch(/refresh_token=;/);
      expect(cookies).not.toMatch(/logout_state=[^;]/);
    } finally {
      await app.close();
    }
  });

  it('flag default (nothing configured): behaves as off', async () => {
    const app = await boot({ validTokens: ['a'] });
    try {
      const res = await logout(app, ['access_token=a']).expect(200);
      expect(res.body).toEqual({ redirect_to: null });
    } finally {
      await app.close();
    }
  });

  it('flag on, valid access cookie: redirect_to targets home-auth /logout with the hint, the return URI and the stored state', async () => {
    const app = await boot({ flag: true, validTokens: ['a'] });
    try {
      const res = await logout(app, [
        'access_token=a',
        'refresh_token=r',
      ]).expect(200);
      const url = new URL(redirectOf(res));
      expect(url.origin).toBe(AUTH);
      expect(url.pathname).toBe('/logout');
      expect(url.searchParams.get('client_id')).toBe('home-qrcode');
      expect(url.searchParams.get('post_logout_redirect_uri')).toBe(
        `${FRONTEND}/api/auth/logged-out`,
      );
      expect(url.searchParams.get('access_token_hint')).toBe('a');
      expect(url.searchParams.get('state')).toBe(stateCookie(res));
      expect(url.searchParams.get('state')!.length).toBeGreaterThanOrEqual(43);
      expect(res.headers['cache-control']).toBe('no-store');
      const cookies = setCookies(res);
      expect(cookies.join('\n')).toMatch(/access_token=;/);
      expect(cookies.join('\n')).toMatch(/refresh_token=;/);
      const state = cookies.find(
        (c) => c.startsWith('logout_state=') && !c.startsWith('logout_state=;'),
      )!;
      expect(state).toMatch(/HttpOnly/);
      expect(state).toMatch(/SameSite=Lax/);
      expect(state).toMatch(/Secure/);
      expect(state).toMatch(/Path=\/api\/auth/);
      expect(state).toMatch(/Max-Age=600/);
    } finally {
      await app.close();
    }
  });

  it('flag on, stale access cookie: refreshes for a hint and never stores the new refresh token', async () => {
    const app = await boot({
      flag: true,
      validTokens: ['NEW-ACCESS'],
      refresh: async () => ({
        accessToken: 'NEW-ACCESS',
        refreshToken: 'NEW-REFRESH',
        expiresIn: 900,
      }),
    });
    try {
      const res = await logout(app, ['refresh_token=r']).expect(200);
      expect(
        new URL(redirectOf(res)).searchParams.get('access_token_hint'),
      ).toBe('NEW-ACCESS');
      const cookies = setCookies(res).join('\n');
      expect(cookies).not.toContain('NEW-REFRESH');
      expect(cookies).not.toContain('NEW-ACCESS');
      expect(cookies).toMatch(/refresh_token=;/);
    } finally {
      await app.close();
    }
  });

  it('flag on, no valid token and refresh failing: no hint (confirmation path), still logged out locally', async () => {
    const app = await boot({ flag: true });
    try {
      const res = await logout(app, [
        'access_token=bad',
        'refresh_token=r',
      ]).expect(200);
      const url = new URL(redirectOf(res));
      expect(url.searchParams.has('access_token_hint')).toBe(false);
      expect(setCookies(res).join('\n')).toMatch(/refresh_token=;/);
    } finally {
      await app.close();
    }
  });

  it('refuses a cross-origin POST (no logout-CSRF) and has no side effect', async () => {
    const app = await boot({ flag: true, validTokens: ['a'] });
    try {
      const res = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Sec-Fetch-Site', 'cross-site')
        .set('Cookie', ['access_token=a'])
        .expect(403);
      expect(res.headers['set-cookie']).toBeUndefined();
    } finally {
      await app.close();
    }
  });

  describe('GET /auth/logged-out', () => {
    function loggedOut(
      app: NestExpressApplication,
      query: string,
      cookie?: string,
    ) {
      const req = request(app.getHttpServer()).get(
        `/api/auth/logged-out${query}`,
      );
      if (cookie) req.set('Cookie', [cookie]);
      return req;
    }

    it('matching state: clears the state cookie and lands on /login?logged_out=1', async () => {
      const app = await boot({ flag: true });
      try {
        const res = await loggedOut(
          app,
          '?state=abc123',
          'logout_state=abc123',
        ).expect(302);
        expect(res.headers.location).toBe(`${FRONTEND}/login?logged_out=1`);
        expect(res.headers['cache-control']).toBe('no-store');
        const cleared = setCookies(res).find((c) =>
          c.startsWith('logout_state=;'),
        )!;
        expect(cleared).toMatch(/Path=\/api\/auth/);
      } finally {
        await app.close();
      }
    });

    it.each([
      ['wrong state', '?state=other', 'logout_state=abc123'],
      ['shorter state', '?state=a', 'logout_state=abc123'],
      ['repeated state', '?state=abc123&state=abc123', 'logout_state=abc123'],
      ['no state in query', '', 'logout_state=abc123'],
      ['no state cookie', '?state=abc123', undefined],
      ['empty state', '?state=', 'logout_state=abc123'],
    ])(
      '%s: neutral /login (no banner), never a 500',
      async (_name, query, cookie) => {
        const app = await boot({ flag: true });
        try {
          const res = await loggedOut(app, query, cookie).expect(302);
          expect(res.headers.location).toBe(`${FRONTEND}/login`);
          expect(setCookies(res).join('\n')).toMatch(/logout_state=;/);
        } finally {
          await app.close();
        }
      },
    );
  });
});
