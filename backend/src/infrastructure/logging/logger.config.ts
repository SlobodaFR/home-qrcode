import type { IncomingMessage, ServerResponse } from 'http';
import type { Params } from 'nestjs-pino';
import { pseudonymize } from '../../domain/shared/pseudonymize';

/**
 * Defense in depth only: pino redaction matches object keys (one level per `*`) and never looks
 * inside message strings. The real control is that log messages never interpolate personal data
 * (use pseudonymize()) and that request/response serializers keep no headers, query or body.
 */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'res.headers.location',
  '*.email',
  '*.name',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.client_secret',
  '*.refresh_token',
];

const QUIET_PATHS = [/^\/assets\//];

/**
 * Allow-list error serializer. Pino's default copies every enumerable property, and
 * TypeORM's QueryFailedError carries `query`, `parameters` and `driverError` (emails, names),
 * HTTP client errors carry `response`/`config`. Nest's exception filter logs any non-HTTP
 * error as `{ err }`, so only these fields may reach the logs. Error messages must never
 * interpolate personal data or raw response bodies.
 */
export function serializeError(input: unknown): Record<string, unknown> {
  // pino-http wraps custom serializers: they receive pino's already-serialized plain object
  // (cause chain folded into `message`), which exposes the original error as `raw`.
  const raw = (input as { raw?: unknown } | null)?.raw;
  const error = raw instanceof Error ? raw : input;
  if (!(error instanceof Error)) {
    return { type: typeof error };
  }
  const code = (error as { code?: unknown }).code;
  return {
    type: error.constructor.name,
    message: error.message,
    stack: error.stack,
    code:
      typeof code === 'string' || typeof code === 'number' ? code : undefined,
  };
}

function pathOf(url: string | undefined): string {
  return (url ?? '').split('?')[0] ?? '';
}

export function loggerParams(
  nodeEnv: string | undefined,
  pseudonymSecret: string,
): Params {
  return {
    pinoHttp: {
      level: nodeEnv === 'test' ? 'silent' : 'info',
      redact: REDACT_PATHS,
      serializers: {
        // No headers (cookies, tokens), no query string (OAuth code), no IP.
        req: (req: IncomingMessage) => ({
          method: req.method,
          url: pathOf(req.url),
        }),
        // No headers: Location carries authorization codes, Set-Cookie the session token.
        res: (res: ServerResponse) => ({ statusCode: res.statusCode }),
        err: serializeError,
      },
      // Evaluated when the response finishes, after the auth guard set req.user.
      customProps: (req: IncomingMessage & { user?: { id?: string } }) =>
        req.user?.id
          ? { user: pseudonymize(req.user.id, pseudonymSecret) }
          : {},
      autoLogging: {
        ignore: (req: IncomingMessage) =>
          QUIET_PATHS.some((pattern) => pattern.test(pathOf(req.url))),
      },
      customLogLevel: (
        _req: IncomingMessage,
        res: ServerResponse,
        err?: Error,
      ) => {
        if (err || res.statusCode >= 500) {
          return 'error';
        }
        return res.statusCode >= 400 ? 'warn' : 'info';
      },
      transport:
        nodeEnv === 'development' ? { target: 'pino-pretty' } : undefined,
    },
  };
}
