import { isIP } from 'net';

/**
 * Operational telemetry (convention harnais ops-telemetry). Every event and property listed here
 * leaves the system: never add personal data (emails, IPs, tokens, raw URLs, QR contents, raw ids).
 * Events are anonymous: no user id at all.
 */
export type TelemetryEvent =
  | {
      name: 'runtime_health';
      properties: {
        lag_p50_ms: number;
        lag_p99_ms: number;
        lag_max_ms: number;
        elu: number;
        heap_used_mb: number;
        rss_mb: number;
      };
    }
  | {
      name: 'http_request';
      properties: {
        route: string;
        method: string;
        status: number;
        duration_ms: number;
      };
    };

/** Port (driven side). Fire-and-forget: synchronous, and never throws into the caller. */
export abstract class Telemetry {
  abstract capture(event: TelemetryEvent): void;
}

const FORBIDDEN_KEYS = new Set([
  'email',
  'ip',
  'token',
  'code',
  'secret',
  'client_secret',
  'cookie',
  'authorization',
]);

const SENSITIVE_VALUE_PATTERNS = [
  /@/, // email
  /[0-9a-f]{32,}/i, // tokens, codes, hashes
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, // user, token or code ids
  /^eyJ[\w-]*\.[\w-]+\.[\w-]+$/, // JWT
];

function isSafeValue(value: unknown): boolean {
  if (typeof value === 'number' || typeof value === 'boolean') {
    return true;
  }
  if (typeof value !== 'string') {
    return false; // objects, arrays, null: they could nest anything
  }
  return (
    isIP(value) === 0 &&
    !SENSITIVE_VALUE_PATTERNS.some((pattern) => pattern.test(value))
  );
}

/** Last line of defense: drops any property whose key or value looks like personal or secret data. */
export function sanitizeTelemetryProperties(
  properties: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(properties).filter(
      ([key, value]) =>
        !FORBIDDEN_KEYS.has(key.toLowerCase()) && isSafeValue(value),
    ),
  );
}
