import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SetExpirationUseCase } from '../../../application/expiration/set-expiration.use-case';
import { AttachLogoUseCase } from '../../../application/qr/attach-logo.use-case';
import { DeleteQrUseCase } from '../../../application/qr/delete-qr.use-case';
import { EditTargetUrlUseCase } from '../../../application/qr/edit-target-url.use-case';
import { GenerateQrUseCase } from '../../../application/qr/generate-qr.use-case';
import { ListQrUseCase } from '../../../application/qr/list-qr.use-case';
import { ListSharedWithMeUseCase } from '../../../application/sharing/list-shared-with-me.use-case';
import { ShareQrUseCase } from '../../../application/sharing/share-qr.use-case';
import { UnshareQrUseCase } from '../../../application/sharing/unshare-qr.use-case';
import { ListUsersUseCase } from '../../../application/users/list-users.use-case';
import { LogoCompositorPort } from '../../../domain/qr/logo-compositor.port';
import { QrImageGenerator } from '../../../domain/qr/qr-image-generator';
import { QrRepository } from '../../../domain/qr/qr.repository';
import { QrShareRepository } from '../../../domain/qr/qr-share.repository';
import { QrStoragePort } from '../../../domain/qr/qr-storage.port';
import { UserRepository } from '../../../domain/user/user.repository';
import { MinioQrStorage } from '../../../infrastructure/qr/minio-qr-storage';
import { QrcodeImageGenerator } from '../../../infrastructure/qr/qrcode-image-generator';
import { SharpLogoCompositor } from '../../../infrastructure/qr/sharp-logo-compositor';
import { QrCodeOrmEntity } from '../../../infrastructure/persistence/entities/qr-code.orm-entity';
import { QrShareOrmEntity } from '../../../infrastructure/persistence/entities/qr-share.orm-entity';
import { UserOrmEntity } from '../../../infrastructure/persistence/entities/user.orm-entity';
import { TypeOrmQrRepository } from '../../../infrastructure/persistence/repositories/typeorm-qr.repository';
import { TypeOrmQrShareRepository } from '../../../infrastructure/persistence/repositories/typeorm-qr-share.repository';
import { TypeOrmUserRepository } from '../../../infrastructure/persistence/repositories/typeorm-user.repository';
import { QrController } from '../controllers/qr.controller';

@Module({
  imports: [TypeOrmModule.forFeature([QrCodeOrmEntity, QrShareOrmEntity, UserOrmEntity])],
  controllers: [QrController],
  providers: [
    { provide: QrRepository, useClass: TypeOrmQrRepository },
    { provide: QrShareRepository, useClass: TypeOrmQrShareRepository },
    { provide: UserRepository, useClass: TypeOrmUserRepository },
    { provide: QrStoragePort, useClass: MinioQrStorage },
    { provide: QrImageGenerator, useClass: QrcodeImageGenerator },
    { provide: LogoCompositorPort, useClass: SharpLogoCompositor },
    GenerateQrUseCase,
    AttachLogoUseCase,
    EditTargetUrlUseCase,
    ListQrUseCase,
    DeleteQrUseCase,
    ShareQrUseCase,
    UnshareQrUseCase,
    ListSharedWithMeUseCase,
    ListUsersUseCase,
    { provide: 'SetExpirationUseCase', useClass: SetExpirationUseCase },
  ],
  exports: [QrRepository],
})
export class QrModule {}
