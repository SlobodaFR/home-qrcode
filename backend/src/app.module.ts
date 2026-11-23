import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { join } from 'path';
import { validateEnv } from './infrastructure/config/validate-env';
import { FeatureFlagsModule } from './infrastructure/feature-flags/feature-flags.module';
import { loggerParams } from './infrastructure/logging/logger.config';
import { DatabaseModule } from './infrastructure/persistence/database.module';
import { MinioModule } from './infrastructure/minio/minio.module';
import { TelemetryModule } from './infrastructure/telemetry/telemetry.module';
import { AuthModule } from './interfaces/http/modules/auth.module';
import { HealthModule } from './interfaces/http/modules/health.module';
import { LinksModule } from './interfaces/http/modules/links.module';
import { QrModule } from './interfaces/http/modules/qr.module';
import { RedirectModule } from './interfaces/http/modules/redirect.module';
import { UsersModule } from './interfaces/http/modules/users.module';
import { throttlerOptions } from './interfaces/http/throttling';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        loggerParams(
          config.get<string>('NODE_ENV'),
          config.getOrThrow<string>('PSEUDONYM_SECRET'),
        ),
    }),
    FeatureFlagsModule,
    TelemetryModule,
    DatabaseModule,
    MinioModule,
    AuthModule,
    QrModule,
    LinksModule,
    RedirectModule,
    UsersModule,
    HealthModule,
    ThrottlerModule.forRoot(throttlerOptions),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'frontend', 'dist'),
      exclude: ['/api{*any}'],
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
