import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  RuntimeHealthMonitor,
  RuntimeHealthSample,
} from '../../../infrastructure/observability/runtime-health.monitor';
import { Public } from '../decorators/public.decorator';

/** Internal health check: blocked by Caddy in production, reachable only from the VPS/container. */
@Public()
@SkipThrottle()
@Controller('healthz')
export class HealthController {
  constructor(private readonly monitor: RuntimeHealthMonitor) {}

  @Get()
  health(): { status: 'ok'; runtime: RuntimeHealthSample | null } {
    return { status: 'ok', runtime: this.monitor.lastSample };
  }
}
