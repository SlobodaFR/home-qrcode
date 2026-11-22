import { Global, Module } from '@nestjs/common';
import { FeatureFlags } from '../../domain/shared/feature-flags';
import { createFeatureFlags } from './openfeature-feature-flags';

/** Global: any module can inject the FeatureFlags port without importing this one. */
@Global()
@Module({
  providers: [
    {
      provide: FeatureFlags,
      useFactory: () => createFeatureFlags(process.env),
    },
  ],
  exports: [FeatureFlags],
})
export class FeatureFlagsModule {}
