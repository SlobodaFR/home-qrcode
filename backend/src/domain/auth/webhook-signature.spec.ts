import {
  checkWebhookSignature,
  computeWebhookSignature,
  verifyWebhookSignature,
  WebhookReplayCache,
} from './webhook-signature';

/**
 * FIXED test vectors (contract PC7), copied verbatim from home-auth
 * (backend/src/domain/shared/webhook-signer.spec.ts, PR SlobodaFR/home-auth#83): any change is a
 * change of the contract. Cross-checked with
 * `printf '%s' '<id>.<timestamp>.<body>' | openssl dgst -sha256 -hmac <secret>`: the key is the
 * secret string itself (its 64 hex characters, UTF-8), NOT its decoded bytes.
 */
const SECRET_1 =
  '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';
const SECRET_2 =
  'ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100';
const ID = '3b241101-e2bb-4255-8caf-4136c566a962';
const BODY = '{"userId":"u1"}';
const SIG_1 =
  '41294c53497c1d18871786b2d5c3ec091e6b357638e7104d826de50af8813242';
const SIG_2 =
  '89de6c4652b33d864427b3091771ed8b9266a99b3bf915b126eb4655a2dce09f';

describe('webhook signature test vectors (contract PC7)', () => {
  it('vector 1: HMAC-SHA256(secret, id.timestamp.rawBody)', () => {
    expect(computeWebhookSignature(SECRET_1, ID, '1700000000', BODY)).toBe(
      SIG_1,
    );
  });

  it('vector 2: another secret, same message', () => {
    expect(computeWebhookSignature(SECRET_2, ID, '1700000000', BODY)).toBe(
      SIG_2,
    );
  });

  it('vector 3: body hashed as UTF-8 bytes (non-ASCII user id)', () => {
    expect(
      computeWebhookSignature(
        SECRET_1,
        '9b2f0f6e-8d3a-4f6b-9c1e-2a7d5e4c1b30',
        '1700000123',
        '{"userId":"4b8f-é"}',
      ),
    ).toBe('d9a2c8cec34058ebb100f8b454ba46b1214cf777000d9aab00dda91205d5a3ac');
  });
});

describe('verifyWebhookSignature', () => {
  const NOW = 1_700_000_000;
  const base = {
    secret: SECRET_1,
    id: ID,
    timestamp: '1700000000',
    rawBody: BODY,
    nowSeconds: NOW,
  };

  it('accepts a single valid v1 entry', () => {
    expect(verifyWebhookSignature({ ...base, signature: `v1=${SIG_1}` })).toBe(
      true,
    );
  });

  it('vector 4: accepts the overlap header (two v1= entries) when either matches', () => {
    const header = `v1=${SIG_1},v1=${SIG_2}`;
    expect(verifyWebhookSignature({ ...base, signature: header })).toBe(true);
    expect(
      verifyWebhookSignature({
        ...base,
        secret: SECRET_2,
        signature: header,
      }),
    ).toBe(true);
  });

  it('accepts the matching entry when it comes second, with spaces around the comma', () => {
    expect(
      verifyWebhookSignature({
        ...base,
        signature: `v1=${'0'.repeat(64)}, v1=${SIG_1}`,
      }),
    ).toBe(true);
  });

  it('accepts uppercase hex', () => {
    expect(
      verifyWebhookSignature({
        ...base,
        signature: `v1=${SIG_1.toUpperCase()}`,
      }),
    ).toBe(true);
  });

  it('rejects a signature made with another secret', () => {
    expect(verifyWebhookSignature({ ...base, signature: `v1=${SIG_2}` })).toBe(
      false,
    );
  });

  it('rejects a modified body, id or timestamp', () => {
    const signature = `v1=${SIG_1}`;
    expect(
      verifyWebhookSignature({
        ...base,
        signature,
        rawBody: '{"userId":"u2"}',
      }),
    ).toBe(false);
    expect(
      verifyWebhookSignature({
        ...base,
        signature,
        id: '3b241101-e2bb-4255-8caf-4136c566a963',
      }),
    ).toBe(false);
    expect(
      verifyWebhookSignature({
        ...base,
        signature,
        timestamp: '1700000001',
        nowSeconds: 1_700_000_001,
      }),
    ).toBe(false);
  });

  it.each([
    ['empty', ''],
    ['no version', SIG_1],
    ['unknown version', `v2=${SIG_1}`],
    ['hex too short (31 bytes)', `v1=${SIG_1.slice(2)}`],
    ['hex too long (33 bytes)', `v1=${SIG_1}00`],
    ['not hex', `v1=${'z'.repeat(64)}`],
    ['empty entry', `v1=${SIG_1},`],
    ['valid entry next to a malformed one', `v1=${SIG_1},v1=xyz`],
  ])('rejects a malformed signature header: %s', (_label, signature) => {
    expect(verifyWebhookSignature({ ...base, signature })).toBe(false);
  });

  describe('timestamp window (|now - ts| <= 120 s)', () => {
    const at = (offset: number) => {
      const timestamp = String(NOW + offset);
      return {
        ...base,
        timestamp,
        signature: `v1=${computeWebhookSignature(SECRET_1, ID, timestamp, BODY)}`,
      };
    };

    it('accepts exactly 120 s in the past and in the future', () => {
      expect(verifyWebhookSignature(at(-120))).toBe(true);
      expect(verifyWebhookSignature(at(120))).toBe(true);
    });

    it('rejects 121 s in the past and in the future', () => {
      expect(verifyWebhookSignature(at(-121))).toBe(false);
      expect(verifyWebhookSignature(at(121))).toBe(false);
    });

    it.each(['', 'abc', '17e8', '-1', '1700000000.5', ' 1700000000'])(
      'rejects a timestamp that is not an integer number of seconds: %j',
      (timestamp) => {
        expect(
          verifyWebhookSignature({
            ...base,
            timestamp,
            signature: `v1=${computeWebhookSignature(SECRET_1, ID, timestamp, BODY)}`,
          }),
        ).toBe(false);
      },
    );
  });

  it('rejects an id that is empty, too long or contains characters outside [A-Za-z0-9-]', () => {
    for (const id of ['', 'a'.repeat(65), 'a.b', 'a b', 'é']) {
      expect(
        verifyWebhookSignature({
          ...base,
          id,
          signature: `v1=${computeWebhookSignature(SECRET_1, id, '1700000000', BODY)}`,
        }),
      ).toBe(false);
    }
  });
});

describe('checkWebhookSignature (why a signature is refused, for logs)', () => {
  const NOW = 1_700_000_000;
  const base = {
    secret: SECRET_1,
    id: ID,
    timestamp: '1700000000',
    rawBody: BODY,
    nowSeconds: NOW,
  };

  it("answers 'ok' for a valid signature", () => {
    expect(checkWebhookSignature({ ...base, signature: `v1=${SIG_1}` })).toBe(
      'ok',
    );
  });

  it("answers 'format' for a malformed id, timestamp or signature entry", () => {
    expect(
      checkWebhookSignature({ ...base, id: 'a.b', signature: `v1=${SIG_1}` }),
    ).toBe('format');
    expect(
      checkWebhookSignature({
        ...base,
        timestamp: 'x',
        signature: `v1=${SIG_1}`,
      }),
    ).toBe('format');
    expect(checkWebhookSignature({ ...base, signature: 'v1=zz' })).toBe(
      'format',
    );
    expect(checkWebhookSignature({ ...base, signature: '' })).toBe('format');
  });

  it("answers 'window' when the timestamp is more than 120 s away", () => {
    const timestamp = String(NOW - 121);
    const signature = `v1=${computeWebhookSignature(SECRET_1, ID, timestamp, BODY)}`;
    expect(checkWebhookSignature({ ...base, timestamp, signature })).toBe(
      'window',
    );
  });

  it("answers 'hmac' for a well-formed, fresh signature that does not match", () => {
    expect(checkWebhookSignature({ ...base, signature: `v1=${SIG_2}` })).toBe(
      'hmac',
    );
  });

  it("checks the format before the window (a malformed header with a stale timestamp is 'format')", () => {
    expect(
      checkWebhookSignature({
        ...base,
        timestamp: String(NOW - 500),
        signature: 'v1=zz',
      }),
    ).toBe('format');
  });
});

describe('WebhookReplayCache (id not seen in the last 10 minutes)', () => {
  const TEN_MINUTES = 10 * 60_000;

  it('accepts an id once, then rejects it', () => {
    let now = 0;
    const cache = new WebhookReplayCache(() => now);
    expect(cache.markSeen('id-1')).toBe(true);
    expect(cache.markSeen('id-1')).toBe(false);
    expect(cache.markSeen('id-2')).toBe(true);
  });

  it('keeps an id for 10 minutes, then forgets it', () => {
    let now = 0;
    const cache = new WebhookReplayCache(() => now);
    cache.markSeen('id-1');
    now = TEN_MINUTES - 1;
    expect(cache.markSeen('id-1')).toBe(false);
    now = TEN_MINUTES + 1;
    expect(cache.markSeen('id-1')).toBe(true);
  });

  it('stays bounded: the oldest ids are evicted past the capacity', () => {
    let now = 0;
    const cache = new WebhookReplayCache(() => now, 3);
    for (const id of ['a', 'b', 'c', 'd']) {
      now += 1;
      cache.markSeen(id);
    }
    expect(cache.size).toBe(3);
    expect(cache.markSeen('d')).toBe(false);
    expect(cache.markSeen('a')).toBe(true);
  });
});
