import { Module } from '@nestjs/common';
import { RuntimeHealthMonitor } from '../../../infrastructure/observability/runtime-health.monitor';
import { HealthController } from '../controllers/health.controller';
import { VersionController } from '../controllers/version.controller';

@Module({
  controllers: [HealthController, VersionController],
  providers: [RuntimeHealthMonitor],
})
export class HealthModule {}
