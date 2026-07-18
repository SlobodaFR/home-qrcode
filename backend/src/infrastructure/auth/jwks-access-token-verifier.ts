import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, JWTPayload, jwtVerify } from 'jose';
import { AccessTokenPayload } from '../../domain/auth/access-token-payload';
import { AccessTokenVerifier } from '../../domain/auth/access-token-verifier';

interface AuthServiceJwtPayload extends JWTPayload {
  email?: string;
  name?: string;
}

@Injectable()
export class JwksAccessTokenVerifier extends AccessTokenVerifier {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(private readonly config: ConfigService) {
    super();
    const authBaseUrl = this.config.getOrThrow<string>('AUTH_BASE_URL');
    this.jwks = createRemoteJWKSet(new URL('/.well-known/jwks.json', authBaseUrl));
  }

  async verify(token: string): Promise<AccessTokenPayload | null> {
    try {
      const { payload } = await jwtVerify<AuthServiceJwtPayload>(token, this.jwks);
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
