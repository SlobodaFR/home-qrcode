import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { HandleOAuthCallbackUseCase } from '../../../application/auth/handle-oauth-callback.use-case';
import { HandleSessionRevokedUseCase } from '../../../application/auth/handle-session-revoked.use-case';
import { OAuthClient, TokenPair } from '../../../domain/auth/oauth-client';
import { User } from '../../../domain/user/user';
import { UserRepository } from '../../../domain/user/user.repository';
import { AuthController } from './auth.controller';

const mockTokens: TokenPair = { accessToken: 'at', refreshToken: 'rt', expiresIn: 3600 };
const mockUser = User.create({ id: 'u1', email: 'a@b.com', name: 'Alice', avatarUrl: 'https://avatar.png', createdAt: new Date() });

const makeRes = () => ({ redirect: jest.fn(), cookie: jest.fn(), clearCookie: jest.fn() }) as unknown as Response;

const makeController = async (userInDb: User | null = mockUser) => {
  const module = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [
      { provide: OAuthClient, useValue: { authorizeUrl: jest.fn().mockReturnValue('https://auth.example.com/authorize?client_id=x&redirect_uri=y') } },
      { provide: HandleOAuthCallbackUseCase, useValue: { execute: jest.fn().mockResolvedValue({ tokens: mockTokens, user: mockUser }) } },
      { provide: HandleSessionRevokedUseCase, useValue: { execute: jest.fn().mockResolvedValue(undefined) } },
      { provide: ConfigService, useValue: { getOrThrow: jest.fn((k: string) => ({ FRONTEND_URL: 'https://app.example.com', AUTH_WEBHOOK_SECRET: 'secret-123' }[k] ?? '')), get: jest.fn().mockReturnValue('test') } },
      { provide: UserRepository, useValue: { findById: jest.fn().mockResolvedValue(userInDb), findByEmail: jest.fn(), findAll: jest.fn(), save: jest.fn() } },
    ],
  }).compile();
  return {
    controller: module.get(AuthController),
    oauthClient: module.get<jest.Mocked<OAuthClient>>(OAuthClient),
    callbackUseCase: module.get<jest.Mocked<HandleOAuthCallbackUseCase>>(HandleOAuthCallbackUseCase),
    sessionRevokedUseCase: module.get<jest.Mocked<HandleSessionRevokedUseCase>>(HandleSessionRevokedUseCase),
  };
};

describe('AuthController', () => {
  // Test 26 — TPP: constant
  it('should redirect to authorizeUrl on GET /auth/login', async () => {
    const { controller, oauthClient } = await makeController();
    const res = makeRes();
    controller.login(res);
    expect(oauthClient.authorizeUrl).toHaveBeenCalledWith(expect.stringContaining('/api/auth/callback'));
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('auth.example.com'));
  });

  // Test 27 — TPP: variable
  it('should set cookies and redirect to FRONTEND_URL on GET /auth/callback', async () => {
    const { controller } = await makeController();
    const res = makeRes();
    await controller.callback('code-abc', res);
    expect(res.cookie).toHaveBeenCalledWith('access_token', 'at', expect.any(Object));
    expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'rt', expect.any(Object));
    expect(res.redirect).toHaveBeenCalledWith('https://app.example.com');
  });

  // Test 28 — TPP: constant
  it('should clear auth cookies and return 204 on POST /auth/logout', async () => {
    const { controller } = await makeController();
    const res = makeRes();
    controller.logout(res);
    const cookieOpts = { httpOnly: true, secure: false, sameSite: 'lax', path: '/' };
    expect(res.clearCookie).toHaveBeenCalledWith('access_token', cookieOpts);
    expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', cookieOpts);
  });

  // Test 29 — TPP: conditional
  it('should execute handleSessionRevoked and return 204 when disconnect secret matches', async () => {
    const { controller, sessionRevokedUseCase } = await makeController();
    await controller.disconnect({ userId: 'u1' }, 'secret-123');
    expect(sessionRevokedUseCase.execute).toHaveBeenCalledWith('u1');
  });

  // Test 30 — TPP: conditional
  it('should throw UnauthorizedException on POST /auth/disconnect when secret is wrong', async () => {
    const { controller } = await makeController();
    await expect(controller.disconnect({ userId: 'u1' }, 'wrong')).rejects.toThrow('Unauthorized');
  });

  // T27 — TPP: variable (internal-sharing: avatarUrl from DB)
  it('me() should return id, email, name and avatarUrl fetched from UserRepository', async () => {
    const { controller } = await makeController(mockUser);
    const result = await controller.me({ id: 'u1', email: 'a@b.com', name: 'Alice' });
    expect(result.id).toBe('u1');
    expect(result.name).toBe('Alice');
    expect(result.avatarUrl).toBe('https://avatar.png');
  });

  // T28 — TPP: conditional (internal-sharing: avatarUrl fallback)
  it('me() should return avatarUrl as empty string when UserRepository.findById returns null', async () => {
    const { controller } = await makeController(null);
    const result = await controller.me({ id: 'u1', email: 'a@b.com', name: 'Alice' });
    expect(result.avatarUrl).toBe('');
  });

  // Test 31 — TPP: constant (kept for compatibility check)
  it('should return id/email/name on GET /auth/me', async () => {
    const { controller } = await makeController();
    const result = await controller.me({ id: 'u1', email: 'a@b.com', name: 'Alice' });
    expect(result.id).toBe('u1');
    expect(result.email).toBe('a@b.com');
  });
});
