import type { Request } from 'express';

/**
 * Parameterized route of a request ('/api/qr/:id'), never the raw URL: no ids, query string or
 * tokens. Requests that matched no Nest route are reported as 'unknown'.
 */
export function routeOf(req: Request): string {
  const path = (req.route as { path?: unknown } | undefined)?.path;
  return typeof path === 'string' ? `${req.baseUrl}${path}` : 'unknown';
}
