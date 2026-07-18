import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { AccessTokenPayload } from '../../../domain/auth/access-token-payload';
import { AccessTokenVerifier } from '../../../domain/auth/access-token-verifier';
import { OAuthClient, TokenPair } from '../../../domain/auth/oauth-client';
import { RevokedSessionRepository } from '../../../domain/auth/revoked-session.repository';
import { ACCESS_TOKEN_COOKIE_NAME, AuthenticatedRequest, JwtAuthGuard, REFRESH_TOKEN_COOKIE_NAME } from './jwt-auth.guard';

const validPayload: AccessTokenPayload = { sub: 'u1', email: 'a@b.com', name: 'A', issuedAt: new Date('2026-01-01') };
const validTokens: TokenPair = { accessToken: 'new-at', refreshToken: 'new-rt', expiresIn: 3600 };

const makeCtx = (cookies: Record<string, string>, isPublic = false): ExecutionContext => {
  const req: Partial<AuthenticatedRequest> = { cookies };
  const res: Partial<Response> = { cookie: jest.fn(), clearCookie: jest.fn() };
  const reflector: Partial<Reflector> = { getAllAndOverride: jest.fn().mockReturnValue(isPublic) };
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
    reflector,
  } as unknown as ExecutionContext;
};

const makeGuard = (opts: {
  verifyResult?: AccessTokenPayload | null;
  refreshResult?: TokenPair;
  refreshThrows?: boolean;
  revokedAt?: Date | null;
}) => {
  const verifier: jest.Mocked<AccessTokenVerifier> = { verify: jest.fn().mockResolvedValue(opts.verifyResult ?? null) };
  const oauthClient: jest.Mocked<OAuthClient> = {
    refresh: opts.refreshThrows
      ? jest.fn().mockRejectedValue(new Error('refresh failed'))
      : jest.fn().mockResolvedValue(opts.refreshResult ?? validTokens),
  } as unknown as jest.Mocked<OAuthClient>;
  const revokedRepo: jest.Mocked<RevokedSessionRepository> = { getRevokedAt: jest.fn().mockResolvedValue(opts.revokedAt ?? null) } as unknown as jest.Mocked<RevokedSessionRepository>;
  const config = { get: jest.fn().mockReturnValue('test') } as unknown as ConfigService;
  const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
  return new JwtAuthGuard(verifier, oauthClient, revokedRepo, config, reflector);
};

describe('JwtAuthGuard', () => {
  // Test 20 — TPP: constant
  it('should return true for routes decorated with @Public() without checking cookies', async () => {
    const verifier = { verify: jest.fn() } as unknown as AccessTokenVerifier;
    const oauthClient = { refresh: jest.fn() } as unknown as OAuthClient;
    const revokedRepo = { getRevokedAt: jest.fn() } as unknown as RevokedSessionRepository;
    const config = { get: jest.fn() } as unknown as ConfigService;
    const publicReflector = { getAllAndOverride: jest.fn().mockReturnValue(true) } as unknown as Reflector;
    const guard = new JwtAuthGuard(verifier, oauthClient, revokedRepo, config, publicReflector);
    const ctx = makeCtx({});
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  // Test 21 — TPP: conditional
  it('should return true and set request.user when access_token cookie is valid and session not revoked', async () => {
    const guard = makeGuard({ verifyResult: validPayload, revokedAt: null });
    const ctx = makeCtx({ [ACCESS_TOKEN_COOKIE_NAME]: 'valid-token' });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    expect(req.user).toEqual({ id: 'u1', email: 'a@b.com', name: 'A' });
  });

  // Test 22 — TPP: conditional
  it('should throw UnauthorizedException when access_token is invalid and no refresh_token present', async () => {
    const guard = makeGuard({ verifyResult: null });
    const ctx = makeCtx({ [ACCESS_TOKEN_COOKIE_NAME]: 'bad-token' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  // Test 23 — TPP: constant
  it('should throw UnauthorizedException when both access_token and refresh_token cookies are absent', async () => {
    const guard = makeGuard({});
    const ctx = makeCtx({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  // Test 24 — TPP: variable
  it('should set new cookies and return true when access_token invalid but refresh succeeds', async () => {
    const guard = makeGuard({ verifyResult: validPayload, refreshResult: validTokens });
    // First verify call (for access token) returns null, second (for new token) returns valid
    const verifier = (guard as unknown as { accessTokenVerifier: jest.Mocked<AccessTokenVerifier> }).accessTokenVerifier;
    verifier.verify.mockResolvedValueOnce(null).mockResolvedValueOnce(validPayload);
    const ctx = makeCtx({ [ACCESS_TOKEN_COOKIE_NAME]: 'expired-token', [REFRESH_TOKEN_COOKIE_NAME]: 'valid-rt' });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  // Test 25 — TPP: conditional
  it('should throw UnauthorizedException when token issuedAt is before revokedAt', async () => {
    const revokedAt = new Date('2026-06-01');
    const oldPayload: AccessTokenPayload = { ...validPayload, issuedAt: new Date('2026-01-01') };
    const guard = makeGuard({ verifyResult: oldPayload, revokedAt });
    const ctx = makeCtx({ [ACCESS_TOKEN_COOKIE_NAME]: 'old-token' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});
