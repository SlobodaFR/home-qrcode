import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { HandleOAuthCallbackUseCase } from '../../../application/auth/handle-oauth-callback.use-case';
import { HandleSessionRevokedUseCase } from '../../../application/auth/handle-session-revoked.use-case';
import { OAuthClient, TokenPair } from '../../../domain/auth/oauth-client';
import { User } from '../../../domain/user/user';
import { AuthController } from './auth.controller';

const mockTokens: TokenPair = { accessToken: 'at', refreshToken: 'rt', expiresIn: 3600 };
const mockUser = User.create({ id: 'u1', email: 'a@b.com', name: 'Alice', avatarUrl: '', createdAt: new Date() });

const makeRes = () => ({ redirect: jest.fn(), cookie: jest.fn(), clearCookie: jest.fn() }) as unknown as Response;

const makeController = async () => {
  const module = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [
      { provide: OAuthClient, useValue: { authorizeUrl: jest.fn().mockReturnValue('https://auth.example.com/authorize?client_id=x&redirect_uri=y') } },
      { provide: HandleOAuthCallbackUseCase, useValue: { execute: jest.fn().mockResolvedValue({ tokens: mockTokens, user: mockUser }) } },
      { provide: HandleSessionRevokedUseCase, useValue: { execute: jest.fn().mockResolvedValue(undefined) } },
      { provide: ConfigService, useValue: { getOrThrow: jest.fn((k: string) => ({ FRONTEND_URL: 'https://app.example.com', AUTH_WEBHOOK_SECRET: 'secret-123' }[k] ?? '')), get: jest.fn().mockReturnValue('test') } },
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
    expect(res.clearCookie).toHaveBeenCalledWith('access_token');
    expect(res.clearCookie).toHaveBeenCalledWith('refresh_token');
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

  // Test 31 — TPP: constant
  it('should return { user } from @CurrentUser on GET /auth/me', async () => {
    const { controller } = await makeController();
    const result = controller.me({ id: 'u1', email: 'a@b.com', name: 'Alice' });
    expect(result).toEqual({ user: { id: 'u1', email: 'a@b.com', name: 'Alice' } });
  });
});
