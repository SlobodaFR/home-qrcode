import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createRemoteJWKSet,
  JWTPayload,
  jwtVerify,
  JWTVerifyOptions,
} from 'jose';
import { AccessTokenPayload } from '../../domain/auth/access-token-payload';
import { AccessTokenVerifier } from '../../domain/auth/access-token-verifier';
import { FeatureFlags } from '../../domain/shared/feature-flags';

interface AuthServiceJwtPayload extends JWTPayload {
  email?: string;
  name?: string;
}

/** Flag (default off = previous behaviour): checks aud, iss and the RS256 algorithm (contract PC3). */
const VERIFY_CLAIMS_FLAG = 'auth-verify-token-claims';

@Injectable()
export class JwksAccessTokenVerifier extends AccessTokenVerifier {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private readonly claims: JWTVerifyOptions;

  constructor(
    private readonly config: ConfigService,
    private readonly flags: FeatureFlags,
  ) {
    super();
    const authBaseUrl = this.config.getOrThrow<string>('AUTH_BASE_URL');
    this.jwks = createRemoteJWKSet(
      new URL('/.well-known/jwks.json', authBaseUrl),
    );
    this.claims = {
      audience: this.config.getOrThrow<string>('AUTH_CLIENT_ID'),
      issuer: new URL(authBaseUrl).origin,
      algorithms: ['RS256'],
    };
  }

  async verify(token: string): Promise<AccessTokenPayload | null> {
    try {
      const strict = await this.flags.isEnabled(VERIFY_CLAIMS_FLAG, false);
      const { payload } = await jwtVerify<AuthServiceJwtPayload>(
        token,
        this.jwks,
        strict ? this.claims : undefined,
      );
      if (!payload.sub || !payload.email || !payload.name || !payload.iat) {
        return null;
      }
      return {
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        issuedAt: new Date(payload.iat * 1000),
      };
    } catch {
      return null;
    }
  }
}
