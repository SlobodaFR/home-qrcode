/** Used outside production only, so local runs and tests need no setup. Rejected in production. */
export const DEV_PSEUDONYM_SECRET =
  'dev-only-pseudonym-secret-not-for-production';

const MIN_SECRET_BYTES = 32;

const REQUIRED_IN_PRODUCTION = [
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
] as const;

/**
 * Environment validation, run once at startup by ConfigModule. Throwing here stops the service
 * before it serves anything with an unsafe or incomplete configuration. Outside production
 * only a development pseudonym secret is filled in, so local runs and tests need no setup.
 */
export function validateEnv(
  env: Record<string, unknown>,
): Record<string, unknown> {
  const signingSecret = env['AUTH_WEBHOOK_SIGNING_SECRET'];
  if (
    signingSecret !== undefined &&
    signingSecret !== '' &&
    !(typeof signingSecret === 'string' && /^[0-9a-f]{64}$/.test(signingSecret))
  ) {
    throw new Error(
      'AUTH_WEBHOOK_SIGNING_SECRET must be 64 lowercase hexadecimal characters (or unset)',
    );
  }
  const secret =
    typeof env['PSEUDONYM_SECRET'] === 'string' ? env['PSEUDONYM_SECRET'] : '';
  if (env['NODE_ENV'] !== 'production') {
    return { ...env, PSEUDONYM_SECRET: secret || DEV_PSEUDONYM_SECRET };
  }

  for (const variable of REQUIRED_IN_PRODUCTION) {
    const value = env[variable];
    if (typeof value !== 'string' || value === '') {
      throw new Error(`${variable} must be set in production`);
    }
  }
  // Public URLs: OAuth redirect, JWT issuer, short links and QR content.
  for (const variable of ['AUTH_BASE_URL', 'FRONTEND_URL']) {
    assertHttpsUrl(env[variable], variable);
  }
  if (
    Buffer.byteLength(secret, 'utf8') < MIN_SECRET_BYTES ||
    secret === DEV_PSEUDONYM_SECRET
  ) {
    throw new Error(
      `PSEUDONYM_SECRET must be set in production to a random value of at least ${MIN_SECRET_BYTES.toString()} bytes (openssl rand -base64 48)`,
    );
  }
  return env;
}

function assertHttpsUrl(value: unknown, variable: string): void {
  let url: URL | null = null;
  try {
    url = typeof value === 'string' ? new URL(value) : null;
  } catch {
    url = null;
  }
  if (url?.protocol !== 'https:') {
    throw new Error(`${variable} must be set in production to an https:// URL`);
  }
}
