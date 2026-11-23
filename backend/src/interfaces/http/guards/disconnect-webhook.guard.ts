import { createHash, timingSafeEqual } from 'crypto';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  RawBodyRequest,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import {
  checkWebhookSignature,
  WebhookReplayCache,
} from '../../../domain/auth/webhook-signature';
import { FeatureFlags } from '../../../domain/shared/feature-flags';

/** Strict mode (default off): only a valid signature is accepted, the old ?secret= no longer is. */
const REQUIRE_SIGNATURE_FLAG = 'auth-webhook-require-signature';

/** Why the signature did not authenticate the request (logged when the legacy path rescues it). */
type LegacyReason =
  | 'no-signature-headers'
  | 'missing-signing-secret'
  | 'raw-body-unavailable'
  | 'format'
  | 'window'
  | 'hmac';

type SignatureOutcome =
  | { valid: true }
  | { valid: false; reason: LegacyReason };

const LOG_INTERVAL_MS = 5 * 60_000;

/**
 * Authenticates the home-auth logout webhook (contract PC7), in double acceptance: a valid
 * X-Auth-Webhook-* signature OR the old `?secret=` (compared with timingSafeEqual). With the
 * flag `auth-webhook-require-signature` on, only the signature is accepted.
 * - As soon as the id header is non-empty and that id was already accepted (replay), the request
 *   is refused (401), even with a valid `?secret=`; this check runs first. Ids are recorded only
 *   once a signature fully verifies.
 * - Order: no signature header (legacy), replay (401), then missing signing secret, raw body
 *   unavailable, format, window, hmac. A failing flag evaluation counts as not strict.
 * - Without any signature header, or with headers that are invalid (format, window, hmac) or
 *   cannot be checked (no AUTH_WEBHOOK_SIGNING_SECRET, raw body not captured), the old `?secret=` is the fallback
 *   outside strict mode. Strict mode without a signing secret fails closed (one error logged).
 */
@Injectable()
export class DisconnectWebhookGuard implements CanActivate {
  private readonly logger = new Logger(DisconnectWebhookGuard.name);
  private readonly replays = new WebhookReplayCache();
  private misconfigurationReported = false;
  private readonly lastLogged = new Map<string, number>();

  constructor(
    private readonly config: ConfigService,
    private readonly flags: FeatureFlags,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RawBodyRequest<Request>>();
    const strict = await this.strictMode();
    const signingSecret = this.config.get<string>(
      'AUTH_WEBHOOK_SIGNING_SECRET',
    );

    const id = headerValue(request, 'x-auth-webhook-id');
    if (id !== undefined && this.replays.has(id)) {
      throw new UnauthorizedException();
    }
    const outcome: SignatureOutcome = !hasSignatureHeaders(request)
      ? { valid: false, reason: 'no-signature-headers' }
      : signingSecret
        ? this.checkSignature(request, signingSecret)
        : { valid: false, reason: 'missing-signing-secret' };
    if (outcome.valid) {
      this.logThrottled(
        'info:signature',
        'log',
        'disconnect webhook accepted via signature',
      );
      return true;
    }
    if (strict && !signingSecret && !this.misconfigurationReported) {
      this.misconfigurationReported = true;
      this.logger.error(
        'auth-webhook-require-signature is on but AUTH_WEBHOOK_SIGNING_SECRET is not set: every disconnect webhook is refused',
      );
    }
    // Absent, invalid, stale or replayed signature: only the legacy path can still accept, and
    // only outside strict mode. Never logs a value, only the reason.
    if (!strict && this.legacySecretMatches(request)) {
      this.logThrottled(
        outcome.reason,
        'warn',
        `disconnect webhook accepted via legacy ?secret= (reason=${outcome.reason})`,
      );
      return true;
    }
    throw new UnauthorizedException();
  }

  /** Never blocks nor fails the delivery: any problem reading the flag means the code default (off). */
  private async strictMode(): Promise<boolean> {
    try {
      return await this.flags.isEnabled(REQUIRE_SIGNATURE_FLAG, false);
    } catch {
      return false;
    }
  }

  private checkSignature(
    request: RawBodyRequest<Request>,
    signingSecret: string,
  ): SignatureOutcome {
    const signature = headerValue(request, 'x-auth-webhook-signature');
    const id = headerValue(request, 'x-auth-webhook-id');
    const timestamp = headerValue(request, 'x-auth-webhook-timestamp');
    // The signed bytes are the ones received: re-serializing the parsed body is not a proof.
    if (!request.rawBody) {
      return { valid: false, reason: 'raw-body-unavailable' };
    }
    if (
      signature === undefined ||
      id === undefined ||
      timestamp === undefined
    ) {
      return { valid: false, reason: 'format' };
    }
    const rawBody = request.rawBody.toString('utf8');
    const result = checkWebhookSignature({
      secret: signingSecret,
      id,
      timestamp,
      signature,
      rawBody,
      nowSeconds: Math.floor(Date.now() / 1000),
    });
    if (result !== 'ok') {
      return { valid: false, reason: result };
    }
    // Only an authentic, fresh signature records its id.
    if (!this.replays.markSeen(id)) {
      throw new UnauthorizedException();
    }
    return { valid: true };
  }

  /** At most one line per key every 5 minutes: a delivery burst must not flood the logs. */
  private logThrottled(
    key: string,
    level: 'log' | 'warn',
    message: string,
  ): void {
    const now = Date.now();
    const last = this.lastLogged.get(key);
    if (last !== undefined && now - last < LOG_INTERVAL_MS) {
      return;
    }
    this.lastLogged.set(key, now);
    this.logger[level](message);
  }

  private legacySecretMatches(request: Request): boolean {
    const provided: unknown = request.query['secret'];
    if (typeof provided !== 'string') {
      return false;
    }
    const expected = this.config.getOrThrow<string>('AUTH_WEBHOOK_SECRET');
    return timingSafeEqual(digest(provided), digest(expected));
  }
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

/** A non-empty single header value, otherwise undefined. */
function headerValue(request: Request, name: string): string | undefined {
  const value = request.headers[name];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/** Any of the three signature headers is non-empty. */
function hasSignatureHeaders(request: Request): boolean {
  return [
    'x-auth-webhook-id',
    'x-auth-webhook-timestamp',
    'x-auth-webhook-signature',
  ].some((name) => {
    const value = request.headers[name];
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  });
}
