import { DEV_PSEUDONYM_SECRET, validateEnv } from './validate-env';

const PROD = {
  NODE_ENV: 'production',
  PSEUDONYM_SECRET: 'f'.repeat(64),
  AUTH_BASE_URL: 'https://auth.sloboda.fr',
  FRONTEND_URL: 'https://qrcode.sloboda.fr',
  AUTH_CLIENT_ID: 'client-id',
  AUTH_CLIENT_SECRET: 'client-secret',
  AUTH_WEBHOOK_SECRET: 'webhook-secret',
  MINIO_ENDPOINT: 'minio.example.test',
  MINIO_BUCKET: 'bucket',
  MINIO_ACCESS_KEY_ID: 'key',
  MINIO_SECRET_ACCESS_KEY: 'secret',
  MINIO_ASSETS_PATH: 'qrcode-assets/prod',
};

describe('validateEnv', () => {
  it('accepts a complete production environment unchanged', () => {
    expect(validateEnv(PROD)).toEqual(PROD);
  });

  describe('AUTH_WEBHOOK_SIGNING_SECRET (optional, 64 lowercase hex characters)', () => {
    const SECRET =
      '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';

    it('is not required: absent or empty means only the legacy ?secret= path', () => {
      expect(validateEnv(PROD)).toEqual(PROD);
      expect(() =>
        validateEnv({ ...PROD, AUTH_WEBHOOK_SIGNING_SECRET: '' }),
      ).not.toThrow();
    });

    it('accepts 64 lowercase hexadecimal characters, in production and outside', () => {
      const env = { ...PROD, AUTH_WEBHOOK_SIGNING_SECRET: SECRET };
      expect(validateEnv(env)).toEqual(env);
      expect(() =>
        validateEnv({ AUTH_WEBHOOK_SIGNING_SECRET: SECRET }),
      ).not.toThrow();
    });

    it.each([
      ['too short', SECRET.slice(2)],
      ['too long', `${SECRET}00`],
      ['not hexadecimal', 'z'.repeat(64)],
      ['padded', ` ${SECRET}`],
      ['followed by a newline', `${SECRET}\n`],
      [
        'uppercase (home-auth displays lowercase hex, used as is)',
        SECRET.toUpperCase().replace(/^0001/, 'ABCD'),
      ],
    ])('rejects a value that is %s', (_label, value) => {
      expect(() =>
        validateEnv({ ...PROD, AUTH_WEBHOOK_SIGNING_SECRET: value }),
      ).toThrow(
        'AUTH_WEBHOOK_SIGNING_SECRET must be 64 lowercase hexadecimal characters',
      );
      expect(() => validateEnv({ AUTH_WEBHOOK_SIGNING_SECRET: value })).toThrow(
        'AUTH_WEBHOOK_SIGNING_SECRET must be 64 lowercase hexadecimal characters',
      );
    });
  });

  it('does not require anything outside production', () => {
    expect(validateEnv({ NODE_ENV: 'development' })).toEqual({
      NODE_ENV: 'development',
      PSEUDONYM_SECRET: DEV_PSEUDONYM_SECRET,
    });
    expect(validateEnv({}).PSEUDONYM_SECRET).toBe(DEV_PSEUDONYM_SECRET);
  });

  it('keeps a configured pseudonym secret outside production', () => {
    expect(validateEnv({ PSEUDONYM_SECRET: 's' }).PSEUDONYM_SECRET).toBe('s');
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['shorter than 32 bytes', 'x'.repeat(31)],
    ['the development fallback', DEV_PSEUDONYM_SECRET],
  ])('rejects a production pseudonym secret that is %s', (_label, secret) => {
    expect(() => validateEnv({ ...PROD, PSEUDONYM_SECRET: secret })).toThrow(
      'PSEUDONYM_SECRET',
    );
  });

  it.each([
    'AUTH_BASE_URL',
    'FRONTEND_URL',
    'AUTH_CLIENT_ID',
    'AUTH_CLIENT_SECRET',
    'AUTH_WEBHOOK_SECRET',
    'MINIO_ENDPOINT',
    'MINIO_BUCKET',
    'MINIO_ACCESS_KEY_ID',
    'MINIO_SECRET_ACCESS_KEY',
    'MINIO_ASSETS_PATH',
  ])('rejects production without %s', (variable) => {
    expect(() => validateEnv({ ...PROD, [variable]: undefined })).toThrow(
      variable,
    );
    expect(() => validateEnv({ ...PROD, [variable]: '' })).toThrow(variable);
  });

  it.each([
    ['AUTH_BASE_URL over http', { AUTH_BASE_URL: 'http://auth.sloboda.fr' }],
    ['FRONTEND_URL over http', { FRONTEND_URL: 'http://qrcode.sloboda.fr' }],
    ['FRONTEND_URL not a URL', { FRONTEND_URL: 'qrcode.sloboda.fr' }],
  ])('rejects %s in production', (_label, override) => {
    expect(() => validateEnv({ ...PROD, ...override })).toThrow('https://');
  });
});
