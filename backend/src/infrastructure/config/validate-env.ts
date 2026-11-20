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
 * nothing is required, so local runs and tests need no setup.
 */
export function validateEnv(
  env: Record<string, unknown>,
): Record<string, unknown> {
  if (env['NODE_ENV'] !== 'production') return env;

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
