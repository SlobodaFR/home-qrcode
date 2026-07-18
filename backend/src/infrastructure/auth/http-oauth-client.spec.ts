import { ConfigService } from '@nestjs/config';
import { HttpOAuthClient } from './http-oauth-client';

const makeConfig = (overrides: Record<string, string> = {}) => {
  const defaults: Record<string, string> = {
    AUTH_BASE_URL: 'https://auth.example.com',
    AUTH_CLIENT_ID: 'client-id',
    AUTH_CLIENT_SECRET: 'client-secret',
  };
  return {
    getOrThrow: jest.fn((key: string) => overrides[key] ?? defaults[key]),
  } as unknown as ConfigService;
};

describe('HttpOAuthClient', () => {
  // Test 11 — TPP: constant
  it('should build an authorizeUrl containing client_id and redirect_uri', () => {
    const client = new HttpOAuthClient(makeConfig());
    const url = new URL(client.authorizeUrl('https://app/callback'));
    expect(url.origin + url.pathname).toBe('https://auth.example.com/authorize');
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('redirect_uri')).toBe('https://app/callback');
  });

  // Test 12 — TPP: conditional
  it('should throw when the token endpoint returns a non-2xx response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400 });
    const client = new HttpOAuthClient(makeConfig());
    await expect(client.exchangeCode('bad-code', 'https://app/callback')).rejects.toThrow();
  });
});
