import { ConfigService } from '@nestjs/config';
import {
  createPostHogTelemetry,
  PostHogClient,
  PostHogTelemetry,
} from './posthog-telemetry';

type CaptureMessage = Parameters<PostHogClient['capture']>[0];

class FakeClient implements PostHogClient {
  readonly captured: CaptureMessage[] = [];
  shutdowns = 0;
  shutdownTimeouts: (number | undefined)[] = [];
  failing = false;

  capture(message: CaptureMessage): void {
    if (this.failing) {
      throw new Error('network');
    }
    this.captured.push(message);
  }

  async shutdown(timeoutMs?: number): Promise<void> {
    this.shutdowns += 1;
    this.shutdownTimeouts.push(timeoutMs);
    return Promise.resolve();
  }
}

const HEALTH_EVENT = {
  name: 'runtime_health',
  properties: {
    lag_p50_ms: 1,
    lag_p99_ms: 2,
    lag_max_ms: 3,
    elu: 0.1,
    heap_used_mb: 40,
    rss_mb: 90,
  },
} as const;

const REQUEST_EVENT = {
  name: 'http_request',
  properties: {
    route: '/api/qr/:id',
    method: 'GET',
    status: 200,
    duration_ms: 12,
  },
} as const;

describe('PostHogTelemetry', () => {
  it('is disabled without POSTHOG_API_KEY: no client is created, capture does not throw', () => {
    const factory =
      vi.fn<(apiKey: string, options: unknown) => PostHogClient>();

    const telemetry = createPostHogTelemetry(new ConfigService({}), factory);

    expect(() => {
      telemetry.capture(HEALTH_EVENT);
    }).not.toThrow();
    expect(factory).not.toHaveBeenCalled();
  });

  it('needs no pseudonym secret: it is created with the key alone', () => {
    const factory = vi
      .fn<(apiKey: string, options: unknown) => PostHogClient>()
      .mockReturnValue(new FakeClient());

    expect(() =>
      createPostHogTelemetry(
        new ConfigService({ POSTHOG_API_KEY: 'phc_test' }),
        factory,
      ),
    ).not.toThrow();
  });

  it('creates an EU, geoip-free client when a key is set', () => {
    const factory = vi
      .fn<(apiKey: string, options: unknown) => PostHogClient>()
      .mockReturnValue(new FakeClient());

    createPostHogTelemetry(
      new ConfigService({ POSTHOG_API_KEY: 'phc_test' }),
      factory,
    );

    expect(factory).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({
        host: 'https://eu.i.posthog.com',
        disableGeoip: true,
        flushAt: 20,
        flushInterval: 10_000,
      }),
    );
  });

  it('honours POSTHOG_HOST', () => {
    const factory = vi
      .fn<(apiKey: string, options: unknown) => PostHogClient>()
      .mockReturnValue(new FakeClient());

    createPostHogTelemetry(
      new ConfigService({
        POSTHOG_API_KEY: 'phc_test',
        POSTHOG_HOST: 'https://ph.example.org',
      }),
      factory,
    );

    expect(factory).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({ host: 'https://ph.example.org' }),
    );
  });

  it('sends anonymous events: random id, no person profile, no IP, service name', () => {
    const client = new FakeClient();
    const telemetry = new PostHogTelemetry(client);

    telemetry.capture(REQUEST_EVENT);
    telemetry.capture(REQUEST_EVENT);

    const [first, second] = client.captured;
    expect(first.distinctId).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.distinctId).not.toBe(second.distinctId);
    expect(first).toEqual({
      distinctId: first.distinctId,
      event: 'http_request',
      properties: {
        route: '/api/qr/:id',
        method: 'GET',
        status: 200,
        duration_ms: 12,
        service: 'home-qrcode',
        $ip: null,
        $process_person_profile: false,
      },
      disableGeoip: true,
    });
  });

  it('sends runtime_health with its six numeric properties and the service name', () => {
    const client = new FakeClient();

    new PostHogTelemetry(client).capture(HEALTH_EVENT);

    expect(client.captured[0].event).toBe('runtime_health');
    expect(client.captured[0].properties).toMatchObject({
      ...HEALTH_EVENT.properties,
      service: 'home-qrcode',
    });
  });

  it('drops properties that look like personal data', () => {
    const client = new FakeClient();

    new PostHogTelemetry(client).capture({
      name: 'http_request',
      properties: { ...REQUEST_EVENT.properties, route: 'alice@example.com' },
    });

    expect(client.captured[0].properties).not.toHaveProperty('route');
    expect(JSON.stringify(client.captured)).not.toContain('alice');
  });

  it('never throws into the caller', () => {
    const client = new FakeClient();
    client.failing = true;

    expect(() => {
      new PostHogTelemetry(client).capture(HEALTH_EVENT);
    }).not.toThrow();
  });

  it('flushes on application shutdown, bounded to 5 s (under the 10 s Docker stop timeout)', async () => {
    const client = new FakeClient();

    await new PostHogTelemetry(client).onApplicationShutdown();

    expect(client.shutdowns).toBe(1);
    expect(client.shutdownTimeouts).toEqual([5000]);
  });

  it('shuts down cleanly without a client', async () => {
    await expect(
      new PostHogTelemetry(null).onApplicationShutdown(),
    ).resolves.toBeUndefined();
  });
});
