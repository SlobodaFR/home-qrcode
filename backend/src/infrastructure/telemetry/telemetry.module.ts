import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Telemetry } from '../../domain/shared/telemetry';
import { TelemetryInterceptor } from '../../interfaces/http/telemetry.interceptor';
import { createPostHogTelemetry } from './posthog-telemetry';

/** Operational telemetry (runtime_health, http_request). NOOP without POSTHOG_API_KEY. */
@Global()
@Module({
  providers: [
    {
      provide: Telemetry,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createPostHogTelemetry(config),
    },
    { provide: APP_INTERCEPTOR, useClass: TelemetryInterceptor },
  ],
  exports: [Telemetry],
})
export class TelemetryModule {}
