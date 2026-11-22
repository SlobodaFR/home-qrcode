import { Module } from '@nestjs/common';
import { RuntimeHealthMonitor } from '../../../infrastructure/observability/runtime-health.monitor';
import { HealthController } from '../controllers/health.controller';

@Module({
  controllers: [HealthController],
  providers: [RuntimeHealthMonitor],
})
export class HealthModule {}
