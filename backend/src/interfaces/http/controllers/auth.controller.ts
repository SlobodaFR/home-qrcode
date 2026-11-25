import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { HandleOAuthCallbackUseCase } from '../../../application/auth/handle-oauth-callback.use-case';
import { InitiateServiceLogoutUseCase } from '../../../application/auth/initiate-service-logout.use-case';
import { HandleSessionRevokedUseCase } from '../../../application/auth/handle-session-revoked.use-case';
import { OAuthClient } from '../../../domain/auth/oauth-client';
import { UserRepository } from '../../../domain/user/user.repository';
import {
  ACCESS_TOKEN_COOKIE_NAME,
  LOGOUT_STATE_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
  clearAuthCookies,
  clearLogoutStateCookie,
  setAuthCookies,
  setLogoutStateCookie,
} from '../auth-cookies';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../decorators/current-user.decorator';
import { Public } from '../decorators/public.decorator';
import { SessionRevokedDto } from '../dto/session-revoked.dto';
import { SameOriginGuard } from '../guards/same-origin.guard';
import { DisconnectWebhookGuard } from '../guards/disconnect-webhook.guard';
import { EXPENSIVE_ROUTE_THROTTLE } from '../throttling';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly oauthClient: OAuthClient,
    private readonly handleOAuthCallback: HandleOAuthCallbackUseCase,
    private readonly handleSessionRevoked: HandleSessionRevokedUseCase,
    private readonly config: ConfigService,
    private readonly userRepository: UserRepository,
    private readonly initiateServiceLogout: InitiateServiceLogoutUseCase,
  ) {}

  @Public()
  @Throttle(EXPENSIVE_ROUTE_THROTTLE)
  @Get('login')
  login(@Res() res: Response): void {
    res.redirect(this.oauthClient.authorizeUrl(this.callbackUrl()));
  }

  @Public()
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Res() res: Response,
  ): Promise<void> {
    const { tokens } = await this.handleOAuthCallback.execute(
      code,
      this.callbackUrl(),
    );
    setAuthCookies(res, tokens, this.config);
    res.redirect(this.config.getOrThrow<string>('FRONTEND_URL'));
  }

  /**
   * Local logout. Behind `auth-rp-initiated-logout`, also returns the home-auth logout URL (PC10)
   * for the SPA to reach by a top-level navigation; `redirect_to` is null otherwise (local-only).
   * POST + SameOriginGuard: no logout-CSRF. Local cookies are always dropped, the refresh token
   * included (home-auth revokes nothing).
   */
  @Public()
  @UseGuards(SameOriginGuard)
  @Post('logout')
  @HttpCode(200)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ redirect_to: string | null }> {
    // The body may carry a bearer token hint: never cached.
    res.setHeader('Cache-Control', 'no-store');
    const state = randomBytes(32).toString('base64url');
    let redirectTo: string | null = null;
    try {
      redirectTo = await this.initiateServiceLogout.execute({
        accessToken: cookieValue(req, ACCESS_TOKEN_COOKIE_NAME),
        refreshToken: cookieValue(req, REFRESH_TOKEN_COOKIE_NAME),
        state,
        postLogoutRedirectUri: this.frontendUrl('/api/auth/logged-out'),
      });
    } catch {
      // Falls back to the local-only logout.
    }
    clearAuthCookies(res, this.config);
    if (redirectTo) {
      setLogoutStateCookie(res, state, this.config);
    }
    return { redirect_to: redirectTo };
  }

  /**
   * Return from home-auth after a service-initiated logout. No effect besides dropping the state
   * cookie: the state must match the one stored by POST /auth/logout (missing, repeated or
   * different: neutral /login, no banner). Never starts /authorize.
   */
  @Public()
  @Get('logged-out')
  loggedOut(
    @Query('state') state: unknown,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    res.setHeader('Cache-Control', 'no-store');
    const expected = cookieValue(req, LOGOUT_STATE_COOKIE_NAME);
    const matches =
      typeof state === 'string' &&
      state !== '' &&
      expected !== undefined &&
      timingSafeEqual(sha256(state), sha256(expected));
    clearLogoutStateCookie(res, this.config);
    res.redirect(this.frontendUrl(matches ? '/login?logged_out=1' : '/login'));
  }

  @Get('me')
  async me(@CurrentUser() user: CurrentUserPayload) {
    const dbUser = await this.userRepository.findById(user.id);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: dbUser?.avatarUrl ?? '',
    };
  }

  // Server-to-server webhook from home-auth, authenticated by DisconnectWebhookGuard (signature
  // or legacy ?secret=): a burst of session revocations must never be answered with 429.
  @Public()
  @SkipThrottle()
  @UseGuards(DisconnectWebhookGuard)
  @Post('disconnect')
  @HttpCode(204)
  async disconnect(@Body() dto: SessionRevokedDto): Promise<void> {
    await this.handleSessionRevoked.execute(dto.userId);
  }

  private callbackUrl(): string {
    return this.frontendUrl('/api/auth/callback');
  }

  private frontendUrl(path: string): string {
    return new URL(
      path,
      this.config.getOrThrow<string>('FRONTEND_URL'),
    ).toString();
  }
}

function cookieValue(req: Request, name: string): string | undefined {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[name];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function sha256(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}
