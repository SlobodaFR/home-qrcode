import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RevokedSessionOrmEntity } from './entities/revoked-session.orm-entity';
import { UserOrmEntity } from './entities/user.orm-entity';
import { serializedDataSourceFactory } from './serialized-connection';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'better-sqlite3',
        database: config.get<string>('DATABASE_PATH', 'data/qrcode.sqlite'),
        enableWAL: true,
        entities: [UserOrmEntity, RevokedSessionOrmEntity],
        synchronize: true,
        autoLoadEntities: true,
      }),
      // Before initialize(): schema sync already runs on the serialized connection
      // (convention sqlite-serialized-transactions).
      dataSourceFactory: serializedDataSourceFactory,
    }),
  ],
})
export class DatabaseModule {}
