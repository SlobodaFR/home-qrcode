import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { ConfigService } from '@nestjs/config';
import { exportJWK, generateKeyPair, JWK, KeyLike, SignJWT } from 'jose';
import { FeatureFlags } from '../../domain/shared/feature-flags';
import { JwksAccessTokenVerifier } from './jwks-access-token-verifier';

/**
 * Real jose, real JWKS over HTTP: the claims checks (audience, issuer, algorithm) are behind the
 * `auth-verify-token-claims` flag (contract PC3 / X1). Flag off = behaviour before this change.
 */
const FLAG = 'auth-verify-token-claims';
const CLIENT_ID = 'qrcode-client-id';
const KID = 'test-key-1';

class StubFlags extends FeatureFlags {
  readonly calls: [string, boolean][] = [];
  constructor(private readonly enabled: boolean) {
    super();
  }
  isEnabled(key: string, codeDefault: boolean): Promise<boolean> {
    this.calls.push([key, codeDefault]);
    return Promise.resolve(key === FLAG ? this.enabled : codeDefault);
  }
}

describe('JwksAccessTokenVerifier claims (flag auth-verify-token-claims)', () => {
  let server: Server;
  let privateKey: KeyLike;
  let authBaseUrl: string;
  let issuer: string;

  beforeAll(async () => {
    const pair = await generateKeyPair('RS256', { extractable: true });
    privateKey = pair.privateKey;
    const jwk: JWK = {
      ...(await exportJWK(pair.publicKey)),
      kid: KID,
      use: 'sig',
      // No `alg` on the key (home-auth publishes one): jose would then pick the algorithm from the
      // token header, which is exactly what the `algorithms` allow-list must prevent.
    };
    server = createServer((req, res) => {
      if (req.url === '/.well-known/jwks.json') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ keys: [jwk] }));
        return;
      }
      res.statusCode = 404;
      res.end();
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    const { port } = server.address() as AddressInfo;
    // AUTH_BASE_URL with a real path: the expected issuer is still the bare origin (the JWKS URL
    // is built from an absolute path, so the server above serves it either way).
    issuer = `http://127.0.0.1:${port.toString()}`;
    authBaseUrl = `${issuer}/auth/`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const makeVerifier = (flags: FeatureFlags) =>
    new JwksAccessTokenVerifier(
      {
        getOrThrow: (key: string) =>
          ({ AUTH_BASE_URL: authBaseUrl, AUTH_CLIENT_ID: CLIENT_ID })[key],
      } as unknown as ConfigService,
      flags,
    );

  interface TokenOptions {
    audience?: string | string[] | null;
    issuer?: string | null;
    alg?: 'RS256' | 'PS256';
  }

  const sign = (options: TokenOptions = {}) => {
    const jwt = new SignJWT({ email: 'a@example.com', name: 'Alice' })
      .setProtectedHeader({ alg: options.alg ?? 'RS256', kid: KID })
      .setSubject('user-1')
      .setIssuedAt()
      .setExpirationTime('5m');
    if (options.audience !== null) {
      jwt.setAudience(options.audience ?? CLIENT_ID);
    }
    if (options.issuer !== null) {
      jwt.setIssuer(options.issuer ?? issuer);
    }
    return jwt.sign(privateKey);
  };

  describe('flag on', () => {
    const verifier = () => makeVerifier(new StubFlags(true));

    it('accepts a valid token (aud = client id, iss = origin of AUTH_BASE_URL, RS256)', async () => {
      const result = await verifier().verify(await sign());
      expect(result).toMatchObject({
        sub: 'user-1',
        email: 'a@example.com',
        name: 'Alice',
      });
    });

    it('accepts an audience array that contains the client id', async () => {
      expect(
        await verifier().verify(
          await sign({ audience: ['other-app', CLIENT_ID] }),
        ),
      ).not.toBeNull();
    });

    it("rejects a token issued for another app's audience", async () => {
      expect(
        await verifier().verify(await sign({ audience: 'another-client-id' })),
      ).toBeNull();
    });

    it('rejects a token without audience', async () => {
      expect(
        await verifier().verify(await sign({ audience: null })),
      ).toBeNull();
    });

    it('rejects a wrong issuer', async () => {
      expect(
        await verifier().verify(
          await sign({ issuer: 'https://evil.example.com' }),
        ),
      ).toBeNull();
    });

    it('rejects an issuer carrying the path of AUTH_BASE_URL (iss is the origin only)', async () => {
      for (const iss of [`${issuer}/auth`, `${issuer}/auth/`, `${issuer}/`]) {
        expect(await verifier().verify(await sign({ issuer: iss }))).toBeNull();
      }
    });

    it('rejects a token without issuer', async () => {
      expect(await verifier().verify(await sign({ issuer: null }))).toBeNull();
    });

    it('rejects an algorithm other than RS256 (PS256 signed with the same RSA key)', async () => {
      expect(await verifier().verify(await sign({ alg: 'PS256' }))).toBeNull();
    });
  });

  describe('flag off (behaviour before the change)', () => {
    const verifier = () => makeVerifier(new StubFlags(false));

    it('accepts a valid token', async () => {
      expect(await verifier().verify(await sign())).not.toBeNull();
    });

    it('still accepts another audience', async () => {
      expect(
        await verifier().verify(await sign({ audience: 'another-client-id' })),
      ).not.toBeNull();
    });

    it('still accepts an issuer carrying the path of AUTH_BASE_URL', async () => {
      expect(
        await verifier().verify(await sign({ issuer: `${issuer}/auth` })),
      ).not.toBeNull();
    });

    it('still accepts a wrong or missing issuer', async () => {
      expect(
        await verifier().verify(
          await sign({ issuer: 'https://evil.example.com' }),
        ),
      ).not.toBeNull();
      expect(
        await verifier().verify(await sign({ issuer: null })),
      ).not.toBeNull();
    });

    it('still accepts PS256', async () => {
      expect(
        await verifier().verify(await sign({ alg: 'PS256' })),
      ).not.toBeNull();
    });

    it('still rejects a bad signature or garbage', async () => {
      expect(await verifier().verify('not-a-jwt')).toBeNull();
    });
  });

  it('reads the flag with code default false', async () => {
    const flags = new StubFlags(false);
    await makeVerifier(flags).verify(await sign());
    expect(flags.calls).toContainEqual([FLAG, false]);
  });

  it('reads the flag on every verification (the adapter memoizes), so a flip applies without restart', async () => {
    let enabled = false;
    const flags: FeatureFlags = {
      isEnabled: (key, codeDefault) =>
        Promise.resolve(key === FLAG ? enabled : codeDefault),
    };
    const verifier = makeVerifier(flags);
    const token = await sign({ audience: 'another-client-id' });
    expect(await verifier.verify(token)).not.toBeNull();
    enabled = true;
    expect(await verifier.verify(token)).toBeNull();
  });
});
