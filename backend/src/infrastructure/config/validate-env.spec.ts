import { validateEnv } from './validate-env';

const PROD = {
  NODE_ENV: 'production',
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

  it('does not require anything outside production', () => {
    expect(validateEnv({ NODE_ENV: 'development' })).toEqual({
      NODE_ENV: 'development',
    });
    expect(validateEnv({})).toEqual({});
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
