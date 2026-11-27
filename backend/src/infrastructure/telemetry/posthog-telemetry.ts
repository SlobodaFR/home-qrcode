import { randomUUID } from 'crypto';
import { Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostHog } from 'posthog-node';
import {
  sanitizeTelemetryProperties,
  Telemetry,
  TelemetryEvent,
} from '../../domain/shared/telemetry';

const DEFAULT_HOST = 'https://eu.i.posthog.com';
// Under Docker's 10 s stop timeout: an unreachable PostHog must not delay (or get killed during) a restart.
const SHUTDOWN_TIMEOUT_MS = 5_000;

/** The part of the posthog-node client this adapter uses (injectable for tests). */
export interface PostHogClient {
  capture(message: {
    distinctId: string;
    event: string;
    properties: Record<string, unknown>;
    disableGeoip: boolean;
  }): void;
  shutdown(shutdownTimeoutMs?: number): Promise<void>;
}

type PostHogClientFactory = (
  apiKey: string,
  options: {
    host: string;
    disableGeoip: boolean;
    flushAt: number;
    flushInterval: number;
  },
) => PostHogClient;

const createPostHogClient: PostHogClientFactory = (apiKey, options) =>
  new PostHog(apiKey, options);

/** Disabled (no client, no network) when POSTHOG_API_KEY is absent: startup never depends on PostHog. */
export function createPostHogTelemetry(
  config: ConfigService,
  factory: PostHogClientFactory = createPostHogClient,
): PostHogTelemetry {
  const apiKey = config.get<string>('POSTHOG_API_KEY');
  if (!apiKey) {
    return new PostHogTelemetry(null);
  }
  return new PostHogTelemetry(
    factory(apiKey, {
      host: config.get<string>('POSTHOG_HOST') || DEFAULT_HOST,
      disableGeoip: true,
      flushAt: 20,
      flushInterval: 10_000,
    }),
  );
}

export class PostHogTelemetry
  extends Telemetry
  implements OnApplicationShutdown
{
  private readonly logger = new Logger(PostHogTelemetry.name);

  constructor(private readonly client: PostHogClient | null) {
    super();
  }

  capture(event: TelemetryEvent): void {
    if (!this.client) {
      return;
    }
    try {
      this.client.capture({
        // Ops events are anonymous: a throwaway id and no person profile.
        distinctId: randomUUID(),
        event: event.name,
        properties: {
          ...sanitizeTelemetryProperties(event.properties),
          // The PostHog project is shared by several home services.
          service: 'home-qrcode',
          // Release version baked into the image (APP_VERSION, 'dev' outside CI), on every event.
          version: process.env['APP_VERSION'] || 'dev',
          // Belt and braces only: the enforceable control is the project setting "Discard client IP data".
          $ip: null,
          $process_person_profile: false,
        },
        disableGeoip: true,
      });
    } catch (error) {
      this.logger.warn(
        `Telemetry capture failed: ${error instanceof Error ? error.name : 'unknown'}`,
      );
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client?.shutdown(SHUTDOWN_TIMEOUT_MS);
  }
}
