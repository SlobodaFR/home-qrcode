import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

function originOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

/**
 * Security headers for every response (API, QR images, SPA static files).
 * The SPA only loads its own scripts and styles; the one cross-origin
 * resource is the user's avatar, served by home-auth (which can redirect
 * to ui-avatars for generated ones).
 */
export function applySecurityHeaders(
  app: NestExpressApplication,
  authBaseUrl?: string,
): void {
  const authOrigin = originOf(authBaseUrl);
  app.use(
    helmet({
      strictTransportSecurity: { maxAge: 31_536_000, includeSubDomains: true }, // no preload: hard to undo
      frameguard: { action: 'deny' },
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          fontSrc: ["'self'"],
          imgSrc: [
            "'self'",
            'data:',
            ...(authOrigin ? [authOrigin] : []),
            'https://ui-avatars.com',
          ],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          objectSrc: ["'none'"],
        },
      },
    }),
  );
}
