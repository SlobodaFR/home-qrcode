import { QrCodeOrmEntity } from './qr-code.orm-entity';
import { QrShareOrmEntity } from './qr-share.orm-entity';
import { RevokedSessionOrmEntity } from './revoked-session.orm-entity';
import { UserOrmEntity } from './user.orm-entity';

/** Single list of persisted entities: database module, migrations and tests. */
export const ENTITIES = [
  UserOrmEntity,
  QrCodeOrmEntity,
  QrShareOrmEntity,
  RevokedSessionOrmEntity,
];
