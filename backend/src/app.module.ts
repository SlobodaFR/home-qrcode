import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { DatabaseModule } from './infrastructure/persistence/database.module';
import { MinioModule } from './infrastructure/minio/minio.module';
import { AuthModule } from './interfaces/http/modules/auth.module';
import { QrModule } from './interfaces/http/modules/qr.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    MinioModule,
    AuthModule,
    QrModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'frontend', 'dist'),
      exclude: ['/api{*any}'],
    }),
  ],
})
export class AppModule {}
