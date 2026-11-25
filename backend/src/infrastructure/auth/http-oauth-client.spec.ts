import { ConfigService } from '@nestjs/config';
import { HttpOAuthClient } from './http-oauth-client';

const makeConfig = (overrides: Record<string, string> = {}) => {
  const defaults: Record<string, string> = {
    AUTH_BASE_URL: 'https://auth.example.com',
    AUTH_CLIENT_ID: 'client-id',
    AUTH_CLIENT_SECRET: 'client-secret',
  };
  return {
    getOrThrow: vi.fn((key: string) => overrides[key] ?? defaults[key]),
  } as unknown as ConfigService;
};

describe('HttpOAuthClient', () => {
  // Test 11 — TPP: constant
  it('should build an authorizeUrl containing client_id and redirect_uri', () => {
    const client = new HttpOAuthClient(makeConfig());
    const url = new URL(client.authorizeUrl('https://app/callback'));
    expect(url.origin + url.pathname).toBe(
      'https://auth.example.com/authorize',
    );
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('redirect_uri')).toBe('https://app/callback');
  });

  it('should build a logoutUrl on /logout with client_id, return URI, state and optional hint', () => {
    const client = new HttpOAuthClient(makeConfig());
    const url = new URL(
      client.logoutUrl({
        postLogoutRedirectUri: 'https://app/api/auth/logged-out',
        state: 's',
        accessTokenHint: 'tok',
      }),
    );
    expect(url.origin + url.pathname).toBe('https://auth.example.com/logout');
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('post_logout_redirect_uri')).toBe(
      'https://app/api/auth/logged-out',
    );
    expect(url.searchParams.get('state')).toBe('s');
    expect(url.searchParams.get('access_token_hint')).toBe('tok');
    const bare = new URL(
      client.logoutUrl({ postLogoutRedirectUri: 'https://app/x', state: 's' }),
    );
    expect(bare.searchParams.has('access_token_hint')).toBe(false);
  });

  // Test 12 — TPP: conditional
  it('should throw when the token endpoint returns a non-2xx response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400 });
    const client = new HttpOAuthClient(makeConfig());
    await expect(
      client.exchangeCode('bad-code', 'https://app/callback'),
    ).rejects.toThrow('Token request failed');
  });

  it('never puts the raw response body in error messages (status only)', async () => {
    const body =
      'alice@example.com invalid_grant sk-live-abc123 refresh_token=r3fr3sh';
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve(body),
      json: () => Promise.resolve({ error: body }),
    });
    const client = new HttpOAuthClient(makeConfig());

    const failures = await Promise.allSettled([
      client.exchangeCode('bad-code', 'https://app/callback'),
      client.refresh('old'),
      client.fetchUserInfo('token'),
    ]);

    for (const failure of failures) {
      expect(failure.status).toBe('rejected');
      const message = String((failure as PromiseRejectedResult).reason);
      expect(message).toContain('400');
      for (const leaked of [
        'alice@example.com',
        'sk-live',
        'r3fr3sh',
        'invalid_grant',
      ]) {
        expect(message).not.toContain(leaked);
      }
    }
  });
});
