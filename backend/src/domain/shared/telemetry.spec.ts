import { sanitizeTelemetryProperties } from './telemetry';

describe('sanitizeTelemetryProperties', () => {
  it('keeps safe values as they are', () => {
    const safe = {
      duration_ms: 12,
      route: '/api/qr/:id/png',
      method: 'GET',
      status: 200,
      elu: 0.05,
    };

    expect(sanitizeTelemetryProperties(safe)).toEqual(safe);
  });

  it.each([
    ['an email', 'alice@example.com'],
    ['an IPv4 address', '203.0.113.7'],
    ['an IPv6 address', '2001:db8::1'],
    ['a long hex string (token, code, hash)', 'a'.repeat(32)],
    [
      'a JWT',
      ['eyJhbGciOiJSUzI1NiJ9', 'eyJzdWIiOiJ1In0', 'c2lnbmF0dXJl'].join('.'),
    ],
    [
      'a UUID (raw user, token or code id)',
      '8f14e45f-ceea-467a-9575-6b5b4b1f5c11',
    ],
    ['a nested object', { email: 'alice@example.com' }],
    ['an array', ['alice']],
    ['null', null],
  ])('drops %s', (_label, value: unknown) => {
    expect(sanitizeTelemetryProperties({ value, kept: 1 })).toEqual({
      kept: 1,
    });
  });

  it.each([
    'email',
    'ip',
    'token',
    'code',
    'secret',
    'client_secret',
    'cookie',
    'authorization',
    'Email',
  ])('drops the forbidden key %s whatever its value', (key) => {
    expect(sanitizeTelemetryProperties({ [key]: 'harmless', kept: 1 })).toEqual(
      { kept: 1 },
    );
  });
});
