import { minutes, ThrottlerModuleOptions } from '@nestjs/throttler';

/**
 * HTTP rate limit, applied by the global ThrottlerGuard to every controller route.
 *
 * - Keyed on req.ip, resolved through `trust proxy` (see main.ts). IPv6 clients
 *   are grouped by /64, so rotating addresses inside one allocation does not
 *   bypass it.
 * - Budgets are per route and per IP, not one global budget per IP.
 * - In-memory storage: counters reset on restart, fine for a single instance.
 * - Public scan routes (GET /r/:id, GET /q/:id) are marked @SkipThrottle():
 *   a printed QR code can be scanned by many people behind one shared IP.
 */
export const THROTTLE_ERROR_MESSAGE = 'Too many requests, try again later.';

export const throttlerOptions: ThrottlerModuleOptions = {
  errorMessage: THROTTLE_ERROR_MESSAGE,
  ipv6SubnetPrefix: 64,
  throttlers: [{ ttl: minutes(1), limit: 100 }],
};

/** Stricter budget for routes that are expensive (image generation, uploads) or start OAuth. */
export const EXPENSIVE_ROUTE_THROTTLE = {
  default: { limit: 30, ttl: minutes(1) },
};
