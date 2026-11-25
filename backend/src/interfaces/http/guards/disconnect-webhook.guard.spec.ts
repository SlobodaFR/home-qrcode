import { randomUUID } from 'crypto';
import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { MockInstance } from 'vitest';
import { HandleOAuthCallbackUseCase } from '../../../application/auth/handle-oauth-callback.use-case';
import { HandleSessionRevokedUseCase } from '../../../application/auth/handle-session-revoked.use-case';
import { OAuthClient } from '../../../domain/auth/oauth-client';
import { computeWebhookSignature } from '../../../domain/auth/webhook-signature';
import { FeatureFlags } from '../../../domain/shared/feature-flags';
import { UserRepository } from '../../../domain/user/user.repository';
import { InitiateServiceLogoutUseCase } from '../../../application/auth/initiate-service-logout.use-case';
import { AuthController } from '../controllers/auth.controller';

/**
 * POST /auth/disconnect through the real controller and guard (rawBody: true, as in main.ts):
 * contract PC7 double acceptance (valid signature OR the old ?secret=), strict mode behind the
 * `auth-webhook-require-signature` flag.
 */
const LEGACY_SECRET = 'legacy-secret-123';
const SIGNING_SECRET =
  '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';
const OLD_SIGNING_SECRET =
  'ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100';
const REQUIRE_FLAG = 'auth-webhook-require-signature';

interface Setup {
  signingSecret?: string;
  requireSignature?: boolean;
  /** The flag evaluation itself fails (provider error). */
  flagThrows?: boolean;
}

describe('POST /auth/disconnect webhook authentication', () => {
  let app: INestApplication;
  let revoke: ReturnType<typeof vi.fn>;
  let flagCalls: [string, boolean][];

  async function start({
    signingSecret,
    requireSignature = false,
    flagThrows = false,
  }: Setup) {
    revoke = vi.fn().mockResolvedValue(undefined);
    flagCalls = [];
    const config = {
      get: (key: string) =>
        key === 'AUTH_WEBHOOK_SIGNING_SECRET' ? signingSecret : undefined,
      getOrThrow: (key: string) =>
        ({
          AUTH_WEBHOOK_SECRET: LEGACY_SECRET,
          FRONTEND_URL: 'https://app.example.com',
        })[key] ?? '',
    };
    const flags: FeatureFlags = {
      isEnabled: (key, codeDefault) => {
        flagCalls.push([key, codeDefault]);
        if (flagThrows) {
          return Promise.reject(new Error('flag provider down'));
        }
        return Promise.resolve(
          key === REQUIRE_FLAG ? requireSignature : codeDefault,
        );
      },
    };
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: ConfigService, useValue: config },
        { provide: FeatureFlags, useValue: flags },
        { provide: OAuthClient, useValue: {} },
        { provide: HandleOAuthCallbackUseCase, useValue: {} },
        { provide: HandleSessionRevokedUseCase, useValue: { execute: revoke } },
        { provide: UserRepository, useValue: {} },
        { provide: InitiateServiceLogoutUseCase, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication({ rawBody: true });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    // Listening once, instead of one ephemeral port per request: no reuse of a closed port by a parallel test file.
    await app.listen(0, '127.0.0.1');
  }

  afterEach(async () => {
    await app?.close();
  });

  const nowSeconds = () => Math.floor(Date.now() / 1000);

  interface Delivery {
    body?: string;
    id?: string;
    timestamp?: string;
    /** Secrets to sign with (one v1= entry each); default: the current signing secret. */
    signWith?: string[];
    /** Overrides the computed signature header. */
    signature?: string | null;
    query?: string;
  }

  function deliver(delivery: Delivery = {}) {
    const body = delivery.body ?? JSON.stringify({ userId: 'u1' });
    const id = delivery.id ?? randomUUID();
    const timestamp = delivery.timestamp ?? String(nowSeconds());
    const signature =
      delivery.signature === undefined
        ? (delivery.signWith ?? [SIGNING_SECRET])
            .map((s) => `v1=${computeWebhookSignature(s, id, timestamp, body)}`)
            .join(',')
        : delivery.signature;
    let call = request(app.getHttpServer())
      .post(`/auth/disconnect${delivery.query ?? ''}`)
      .set('Content-Type', 'application/json')
      .set('X-Auth-Webhook-Id', id)
      .set('X-Auth-Webhook-Timestamp', timestamp);
    if (signature !== null) {
      call = call.set('X-Auth-Webhook-Signature', signature);
    }
    return call.send(body);
  }

  const legacyOnly = (query = `?secret=${LEGACY_SECRET}`) =>
    request(app.getHttpServer())
      .post(`/auth/disconnect${query}`)
      .send({ userId: 'u1' });

  describe('signing secret configured, flag off (double acceptance)', () => {
    beforeEach(() => start({ signingSecret: SIGNING_SECRET }));

    it('accepts a valid signature without the legacy ?secret=', async () => {
      await deliver().expect(204);
      expect(revoke).toHaveBeenCalledWith('u1');
    });

    it('accepts a valid signature next to a legacy ?secret=', async () => {
      await deliver({ query: `?secret=${LEGACY_SECRET}` }).expect(204);
    });

    it('accepts a body that is not canonical JSON, signed as received (rawBody, not re-serialized)', async () => {
      await deliver({ body: '{ "userId" : "u1" }' }).expect(204);
      expect(revoke).toHaveBeenCalledWith('u1');
    });

    it('accepts a non-ASCII user id (UTF-8 bytes signed)', async () => {
      await deliver({ body: JSON.stringify({ userId: '4b8f-é' }) }).expect(204);
      expect(revoke).toHaveBeenCalledWith('4b8f-é');
    });

    it('accepts the overlap header when the second entry matches (secret regeneration)', async () => {
      await deliver({ signWith: [OLD_SIGNING_SECRET, SIGNING_SECRET] }).expect(
        204,
      );
    });

    it('rejects a signature made with another secret', async () => {
      await deliver({ signWith: [OLD_SIGNING_SECRET] }).expect(401);
      expect(revoke).not.toHaveBeenCalled();
    });

    it('rejects a signed delivery whose body was altered', async () => {
      const id = randomUUID();
      const timestamp = String(nowSeconds());
      const signature = `v1=${computeWebhookSignature(SIGNING_SECRET, id, timestamp, '{"userId":"u1"}')}`;
      await request(app.getHttpServer())
        .post('/auth/disconnect')
        .set('Content-Type', 'application/json')
        .set('X-Auth-Webhook-Id', id)
        .set('X-Auth-Webhook-Timestamp', timestamp)
        .set('X-Auth-Webhook-Signature', signature)
        .send('{"userId":"victim"}')
        .expect(401);
      expect(revoke).not.toHaveBeenCalled();
    });

    it('rejects a timestamp more than 120 s old, or in the future', async () => {
      await deliver({ timestamp: String(nowSeconds() - 125) }).expect(401);
      await deliver({ timestamp: String(nowSeconds() + 125) }).expect(401);
      expect(revoke).not.toHaveBeenCalled();
    });

    it('rejects a replayed id (401) when nothing else authenticates it', async () => {
      const id = randomUUID();
      await deliver({ id }).expect(204);
      await deliver({ id }).expect(401);
      expect(revoke).toHaveBeenCalledTimes(1);
    });

    it('rejects a replayed id (401) even with a valid legacy ?secret=', async () => {
      const id = randomUUID();
      await deliver({ id }).expect(204);
      await deliver({ id, query: `?secret=${LEGACY_SECRET}` }).expect(401);
      expect(revoke).toHaveBeenCalledTimes(1);
    });

    it('checks the seen id first: a replayed id with a malformed signature and a valid ?secret= is refused', async () => {
      const id = randomUUID();
      await deliver({ id }).expect(204);
      await deliver({
        id,
        signature: 'garbage',
        query: `?secret=${LEGACY_SECRET}`,
      }).expect(401);
      await deliver({
        id,
        signature: null,
        timestamp: 'not-a-number',
        query: `?secret=${LEGACY_SECRET}`,
      }).expect(401);
      expect(revoke).toHaveBeenCalledTimes(1);
    });

    it('refuses a lone seen X-Auth-Webhook-Id header even with a valid legacy ?secret=', async () => {
      const id = randomUUID();
      await deliver({ id }).expect(204);
      await request(app.getHttpServer())
        .post(`/auth/disconnect?secret=${LEGACY_SECRET}`)
        .set('X-Auth-Webhook-Id', id)
        .send({ userId: 'u1' })
        .expect(401);
      expect(revoke).toHaveBeenCalledTimes(1);
    });

    it('falls back to the legacy ?secret= for a lone unseen id (headers present but unusable)', async () => {
      await request(app.getHttpServer())
        .post(`/auth/disconnect?secret=${LEGACY_SECRET}`)
        .set('X-Auth-Webhook-Id', randomUUID())
        .send({ userId: 'u1' })
        .expect(204);
    });

    it('a delivery accepted through the legacy ?secret= does not record its id', async () => {
      const id = randomUUID();
      await deliver({
        id,
        signature: 'garbage',
        query: `?secret=${LEGACY_SECRET}`,
      }).expect(204);
      await deliver({ id, query: `?secret=${LEGACY_SECRET}` }).expect(204);
      await deliver({ id }).expect(401);
    });

    it('falls through to a valid legacy ?secret= on a stale signed delivery', async () => {
      await deliver({
        timestamp: String(nowSeconds() - 125),
        query: `?secret=${LEGACY_SECRET}`,
      }).expect(204);
    });

    it('does not burn an id on a failed signature', async () => {
      const id = randomUUID();
      await deliver({ id, signWith: [OLD_SIGNING_SECRET] }).expect(401);
      await deliver({ id }).expect(204);
    });

    it.each([
      ['v2 entry', `v2=${'0'.repeat(64)}`],
      ['31 bytes', `v1=${'0'.repeat(62)}`],
      ['not hex', `v1=${'g'.repeat(64)}`],
      ['empty', ''],
    ])(
      'rejects a malformed signature header (%s) without a legacy secret',
      async (_l, signature) => {
        await deliver({ signature }).expect(401);
      },
    );

    it('falls back to the legacy ?secret= when the signature is invalid (double acceptance)', async () => {
      await deliver({
        signWith: [OLD_SIGNING_SECRET],
        query: `?secret=${LEGACY_SECRET}`,
      }).expect(204);
      await deliver({
        signature: 'garbage',
        query: `?secret=${LEGACY_SECRET}`,
      }).expect(204);
    });

    it('accepts the legacy ?secret= alone, as before', async () => {
      await legacyOnly().expect(204);
      expect(revoke).toHaveBeenCalledWith('u1');
    });

    it('rejects a wrong, missing, empty or repeated legacy secret', async () => {
      await legacyOnly('?secret=nope').expect(401);
      await legacyOnly('').expect(401);
      await legacyOnly('?secret=').expect(401);
      await legacyOnly(`?secret=nope&secret=${LEGACY_SECRET}`).expect(401);
      expect(revoke).not.toHaveBeenCalled();
    });

    it('authenticates before validating the body (401, not 400)', async () => {
      await request(app.getHttpServer())
        .post('/auth/disconnect')
        .send({})
        .expect(401);
    });

    it('still rejects an authenticated delivery with an invalid body (400)', async () => {
      await deliver({ body: '{"user":"u1"}' }).expect(400);
    });

    it('reads the strict-mode flag with code default false', async () => {
      await deliver().expect(204);
      expect(flagCalls).toContainEqual([REQUIRE_FLAG, false]);
    });
  });

  describe('a failing flag evaluation is treated as non-strict', () => {
    beforeEach(() =>
      start({ signingSecret: SIGNING_SECRET, flagThrows: true }),
    );

    it('still accepts the legacy ?secret= (no 500)', async () => {
      await legacyOnly().expect(204);
      expect(flagCalls).toContainEqual([REQUIRE_FLAG, false]);
    });

    it('still accepts a valid signature', async () => {
      await deliver().expect(204);
    });

    it('still refuses a wrong legacy ?secret= (401, not 500)', async () => {
      await legacyOnly('?secret=wrong').expect(401);
    });
  });

  describe('observability before the strict flip', () => {
    const FIVE_MINUTES = 5 * 60_000;
    let warn: MockInstance<Logger['warn']>;
    let info: MockInstance<Logger['log']>;

    const warnings = () => warn.mock.calls.map((call) => String(call[0]));
    const infos = () => info.mock.calls.map((call) => String(call[0]));

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-11-22T12:00:00Z'));
      warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
      info = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      warn.mockRestore();
      info.mockRestore();
      vi.useRealTimers();
    });

    it('warns with reason=no-signature-headers when the legacy ?secret= is used without any signature header', async () => {
      await start({ signingSecret: SIGNING_SECRET });
      await legacyOnly().expect(204);
      expect(warnings()).toHaveLength(1);
      expect(warnings()[0]).toContain('reason=no-signature-headers');
    });

    it('warns with reason=no-signature-headers (not missing-signing-secret) when no header is sent and no signing secret is configured', async () => {
      await start({});
      await legacyOnly().expect(204);
      expect(warnings()).toHaveLength(1);
      expect(warnings()[0]).toContain('reason=no-signature-headers');
    });

    it.each([
      [
        'format',
        () =>
          deliver({ signature: 'garbage', query: `?secret=${LEGACY_SECRET}` }),
      ],
      [
        'window',
        () =>
          deliver({
            timestamp: String(nowSeconds() - 125),
            query: `?secret=${LEGACY_SECRET}`,
          }),
      ],
      [
        'hmac',
        () =>
          deliver({
            signWith: [OLD_SIGNING_SECRET],
            query: `?secret=${LEGACY_SECRET}`,
          }),
      ],
    ])(
      'warns with reason=%s when the legacy ?secret= rescues an unusable signature',
      async (reason, send) => {
        await start({ signingSecret: SIGNING_SECRET });
        await send().expect(204);
        expect(warnings()).toHaveLength(1);
        expect(warnings()[0]).toContain(`reason=${reason}`);
      },
    );

    it('does not warn for a replayed id: refused, even with a valid ?secret=', async () => {
      await start({ signingSecret: SIGNING_SECRET });
      const id = randomUUID();
      await deliver({ id }).expect(204);
      await deliver({ id, query: `?secret=${LEGACY_SECRET}` }).expect(401);
      expect(warnings()).toHaveLength(0);
    });

    it('warns with reason=format for a lone id header', async () => {
      await start({ signingSecret: SIGNING_SECRET });
      await request(app.getHttpServer())
        .post(`/auth/disconnect?secret=${LEGACY_SECRET}`)
        .set('X-Auth-Webhook-Id', randomUUID())
        .send({ userId: 'u1' })
        .expect(204);
      expect(warnings()).toHaveLength(1);
      expect(warnings()[0]).toContain('reason=format');
    });

    it('warns with reason=missing-signing-secret when signature headers are sent but cannot be checked', async () => {
      await start({});
      await deliver({ query: `?secret=${LEGACY_SECRET}` }).expect(204);
      expect(warnings()).toHaveLength(1);
      expect(warnings()[0]).toContain('reason=missing-signing-secret');
    });

    it('warns with reason=raw-body-unavailable when the raw body was not captured (no JSON.stringify fallback)', async () => {
      await start({ signingSecret: SIGNING_SECRET });
      const id = randomUUID();
      const timestamp = String(nowSeconds());
      const body = JSON.stringify({ userId: 'u1' });
      await request(app.getHttpServer())
        .post(`/auth/disconnect?secret=${LEGACY_SECRET}`)
        .set('Content-Type', 'text/plain')
        .set('X-Auth-Webhook-Id', id)
        .set('X-Auth-Webhook-Timestamp', timestamp)
        .set(
          'X-Auth-Webhook-Signature',
          `v1=${computeWebhookSignature(SIGNING_SECRET, id, timestamp, body)}`,
        )
        .send(body);
      expect(warnings()).toHaveLength(1);
      expect(warnings()[0]).toContain('reason=raw-body-unavailable');
    });

    it('throttles the signature info on its own key, independent of the warning reasons', async () => {
      await start({ signingSecret: SIGNING_SECRET });
      await legacyOnly().expect(204);
      await deliver().expect(204);
      expect(warnings()).toHaveLength(1);
      expect(
        infos().filter((m) => m.includes('accepted via signature')),
      ).toHaveLength(1);
    });

    it('throttles the warning to once per 5 minutes per reason, reasons being independent', async () => {
      await start({ signingSecret: SIGNING_SECRET });
      await legacyOnly().expect(204);
      await legacyOnly().expect(204);
      await deliver({
        signature: 'garbage',
        query: `?secret=${LEGACY_SECRET}`,
      }).expect(204);
      expect(warnings().map((w) => /reason=([a-z-]+)/.exec(w)?.[1])).toEqual([
        'no-signature-headers',
        'format',
      ]);
      vi.setSystemTime(Date.now() + FIVE_MINUTES - 1);
      await legacyOnly().expect(204);
      expect(warnings()).toHaveLength(2);
      vi.setSystemTime(Date.now() + 2);
      await legacyOnly().expect(204);
      expect(warnings()).toHaveLength(3);
    });

    it('never logs a secret, a signature, a user id or a request value', async () => {
      await start({ signingSecret: SIGNING_SECRET });
      await legacyOnly().expect(204);
      await deliver({
        signature: 'v1=deadbeef',
        query: `?secret=${LEGACY_SECRET}`,
      }).expect(204);
      await deliver({
        signWith: [OLD_SIGNING_SECRET],
        query: `?secret=${LEGACY_SECRET}`,
      }).expect(204);
      await deliver().expect(204);
      const logged = [...warnings(), ...infos()].join('\n');
      for (const forbidden of [
        LEGACY_SECRET,
        SIGNING_SECRET,
        OLD_SIGNING_SECRET,
        'deadbeef',
        'u1',
      ]) {
        expect(logged).not.toContain(forbidden);
      }
    });

    it('logs a throttled info "accepted via signature" and no warning for a signed delivery', async () => {
      await start({ signingSecret: SIGNING_SECRET });
      await deliver().expect(204);
      await deliver().expect(204);
      expect(warnings()).toHaveLength(0);
      expect(
        infos().filter((m) => m.includes('accepted via signature')),
      ).toHaveLength(1);
      vi.setSystemTime(Date.now() + FIVE_MINUTES + 1);
      await deliver().expect(204);
      expect(
        infos().filter((m) => m.includes('accepted via signature')),
      ).toHaveLength(2);
    });

    it('does not warn about refused requests (nothing was accepted through the legacy path)', async () => {
      await start({ signingSecret: SIGNING_SECRET });
      await legacyOnly('?secret=nope').expect(401);
      await deliver({ signWith: [OLD_SIGNING_SECRET] }).expect(401);
      expect(warnings()).toHaveLength(0);
    });

    it('does not warn in strict mode (the legacy path is closed)', async () => {
      await start({ signingSecret: SIGNING_SECRET, requireSignature: true });
      await legacyOnly().expect(401);
      await deliver().expect(204);
      expect(warnings()).toHaveLength(0);
    });
  });

  describe('flag auth-webhook-require-signature on (strict)', () => {
    beforeEach(() =>
      start({ signingSecret: SIGNING_SECRET, requireSignature: true }),
    );

    it('accepts a valid signature', async () => {
      await deliver().expect(204);
    });

    it('rejects the legacy ?secret= alone', async () => {
      await legacyOnly().expect(401);
      expect(revoke).not.toHaveBeenCalled();
    });

    it('rejects an invalid signature even with a valid legacy ?secret=', async () => {
      await deliver({
        signWith: [OLD_SIGNING_SECRET],
        query: `?secret=${LEGACY_SECRET}`,
      }).expect(401);
    });

    it('rejects replays, even with a valid legacy ?secret= (replay protection is effective here)', async () => {
      const id = randomUUID();
      await deliver({ id }).expect(204);
      await deliver({ id }).expect(401);
      await deliver({ id, query: `?secret=${LEGACY_SECRET}` }).expect(401);
      expect(revoke).toHaveBeenCalledTimes(1);
    });

    it('rejects a stale signature even with a valid legacy ?secret=', async () => {
      await deliver({
        timestamp: String(nowSeconds() - 125),
        query: `?secret=${LEGACY_SECRET}`,
      }).expect(401);
    });
  });

  describe('no signing secret configured', () => {
    it('keeps the legacy path only: signature headers are ignored', async () => {
      await start({});
      await legacyOnly().expect(204);
      await deliver().expect(401);
      await deliver({ query: `?secret=${LEGACY_SECRET}` }).expect(204);
    });

    it('strict mode without a configured secret fails closed: everything refused, one error logged', async () => {
      const error = vi
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => {});
      try {
        await start({ requireSignature: true });
        await legacyOnly().expect(401);
        await deliver().expect(401);
        await deliver({ query: `?secret=${LEGACY_SECRET}` }).expect(401);
        expect(revoke).not.toHaveBeenCalled();
        expect(error).toHaveBeenCalledTimes(1);
      } finally {
        error.mockRestore();
      }
    });

    it('flag off without a configured secret logs no error', async () => {
      const error = vi
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => {});
      try {
        await start({});
        await legacyOnly().expect(204);
        expect(error).not.toHaveBeenCalled();
      } finally {
        error.mockRestore();
      }
    });
  });
});
