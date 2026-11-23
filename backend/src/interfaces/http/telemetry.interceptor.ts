import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { Telemetry } from '../../domain/shared/telemetry';
import { routeOf } from './route-of';

/**
 * Never reported as http_request (route templates, as returned by routeOf):
 * - '/healthz': polled by the Docker healthcheck every 30 s.
 * - '/r/:id': public scan redirect, no auth and no rate limit (a printed QR code is scanned by
 *   anyone, and anyone can hammer random ids): volume is not ours to control, one event per call
 *   would be a cost amplifier.
 * - '/api/qr/:id/{meta,logo,png,svg}': public and unthrottled read routes, the dashboard and the
 *   public /q/:id page load one image per card on every view.
 *
 * Deliberately kept although public and unthrottled: POST '/api/auth/disconnect' (home-auth
 * back-channel, secret-gated inside the handler): server-to-server and low volume, and its 401s
 * reveal a webhook secret mismatch between home-auth and home-qrcode.
 *
 * Accepted blind spot: no 5xx visibility on the excluded routes (redirect, QR images from MinIO).
 */
const UNREPORTED_ROUTES = new Set([
  '/healthz',
  '/r/:id',
  '/api/qr/:id/meta',
  '/api/qr/:id/logo',
  '/api/qr/:id/png',
  '/api/qr/:id/svg',
]);

/** Reports every request handled by a Nest route (http_request). Static assets and the SPA never reach it. */
@Injectable()
export class TelemetryInterceptor implements NestInterceptor {
  constructor(private readonly telemetry: Telemetry) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // A global interceptor also runs on non-HTTP handlers (WebSocket): no route, no method.
    if (context.getType() !== 'http') {
      return next.handle();
    }
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const route = routeOf(req);
    if (route === 'unknown' || UNREPORTED_ROUTES.has(route)) {
      return next.handle();
    }
    const startedAt = performance.now();
    const report = (status: number) => {
      this.telemetry.capture({
        name: 'http_request',
        properties: {
          route,
          method: req.method,
          status,
          duration_ms: Math.round(performance.now() - startedAt),
        },
      });
    };

    return next.handle().pipe(
      tap({
        next: () => {
          report(res.statusCode);
        },
        // The exception filter writes the response later: derive the status from the error.
        error: (error: unknown) => {
          report(error instanceof HttpException ? error.getStatus() : 500);
        },
      }),
    );
  }
}
