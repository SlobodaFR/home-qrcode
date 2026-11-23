import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Logout webhook signature sent by home-auth (contract PC7).
 * hex = HMAC-SHA256(secret, `${id}.${timestamp}.${rawBody}`), the key being the secret string as
 * stored (64 hex characters, UTF-8; NOT its decoded bytes). rawBody is the exact bytes received.
 */
export function computeWebhookSignature(
  secret: string,
  id: string,
  timestamp: string,
  rawBody: string,
): string {
  return createHmac('sha256', secret)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest('hex');
}

const MAX_CLOCK_SKEW_SECONDS = 120;
const ID_FORMAT = /^[A-Za-z0-9-]{1,64}$/;
const TIMESTAMP_FORMAT = /^\d{1,12}$/;
const SIGNATURE_ENTRY = /^v1=([0-9a-fA-F]{64})$/;

export interface WebhookSignatureCheck {
  secret: string;
  id: string;
  /** X-Auth-Webhook-Timestamp, as received. */
  timestamp: string;
  /** X-Auth-Webhook-Signature, as received: `v1=<hex>[,v1=<hex>]`. */
  signature: string;
  rawBody: string;
  nowSeconds: number;
}

export type WebhookSignatureResult = 'ok' | 'format' | 'window' | 'hmac';

/**
 * 'ok' when the headers are well formed, |now - timestamp| <= 120 s and at least one v1= entry
 * (decoded from hex to 32 bytes) equals the expected HMAC under timingSafeEqual. Otherwise why it
 * is refused: 'format' (id, timestamp or any entry malformed: one bad entry invalidates the whole
 * header), 'window' or 'hmac', checked in that order. Replay (id already seen) is
 * WebhookReplayCache's job.
 */
export function checkWebhookSignature(
  check: WebhookSignatureCheck,
): WebhookSignatureResult {
  const { secret, id, timestamp, signature, rawBody, nowSeconds } = check;
  if (!ID_FORMAT.test(id) || !TIMESTAMP_FORMAT.test(timestamp)) {
    return 'format';
  }
  const candidates: Buffer[] = [];
  for (const entry of signature.split(',')) {
    const match = SIGNATURE_ENTRY.exec(entry.trim());
    if (!match?.[1]) {
      return 'format';
    }
    candidates.push(Buffer.from(match[1], 'hex'));
  }
  if (Math.abs(nowSeconds - Number(timestamp)) > MAX_CLOCK_SKEW_SECONDS) {
    return 'window';
  }
  const expected = createHmac('sha256', secret)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest();
  let matched = false;
  for (const candidate of candidates) {
    // Every entry is compared (no early exit); both buffers are 32 bytes.
    if (
      candidate.length === expected.length &&
      timingSafeEqual(candidate, expected)
    ) {
      matched = true;
    }
  }
  return matched ? 'ok' : 'hmac';
}

export function verifyWebhookSignature(check: WebhookSignatureCheck): boolean {
  return checkWebhookSignature(check) === 'ok';
}

const REPLAY_WINDOW_MS = 10 * 60_000;
const DEFAULT_CAPACITY = 10_000;

/**
 * Webhook ids seen in the last 10 minutes (in memory, lost on restart: the 120 s timestamp window
 * still bounds a replay across a restart). Bounded: the oldest ids are evicted past `capacity`.
 */
export class WebhookReplayCache {
  private readonly expiresAt = new Map<string, number>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly capacity: number = DEFAULT_CAPACITY,
  ) {}

  get size(): number {
    return this.expiresAt.size;
  }

  /** True when the id was accepted within the replay window (read-only, records nothing). */
  has(id: string): boolean {
    this.purge(this.now());
    return this.expiresAt.has(id);
  }

  /** False when the id was already seen in the window; otherwise remembers it and returns true. */
  markSeen(id: string): boolean {
    const now = this.now();
    this.purge(now);
    if (this.expiresAt.has(id)) {
      return false;
    }
    this.expiresAt.set(id, now + REPLAY_WINDOW_MS);
    while (this.expiresAt.size > this.capacity) {
      const oldest = this.expiresAt.keys().next();
      if (oldest.done) break;
      this.expiresAt.delete(oldest.value);
    }
    return true;
  }

  // Constant window: insertion order is expiry order, so only the head needs checking.
  private purge(now: number): void {
    for (const [id, expiry] of this.expiresAt) {
      if (expiry > now) break;
      this.expiresAt.delete(id);
    }
  }
}
