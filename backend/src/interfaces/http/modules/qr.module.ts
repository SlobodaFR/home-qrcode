import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttachLogoUseCase } from '../../../application/qr/attach-logo.use-case';
import { DeleteQrUseCase } from '../../../application/qr/delete-qr.use-case';
import { EditTargetUrlUseCase } from '../../../application/qr/edit-target-url.use-case';
import { GenerateQrUseCase } from '../../../application/qr/generate-qr.use-case';
import { ListQrUseCase } from '../../../application/qr/list-qr.use-case';
import { LogoCompositorPort } from '../../../domain/qr/logo-compositor.port';
import { QrImageGenerator } from '../../../domain/qr/qr-image-generator';
import { QrRepository } from '../../../domain/qr/qr.repository';
import { QrStoragePort } from '../../../domain/qr/qr-storage.port';
import { MinioQrStorage } from '../../../infrastructure/qr/minio-qr-storage';
import { QrcodeImageGenerator } from '../../../infrastructure/qr/qrcode-image-generator';
import { SharpLogoCompositor } from '../../../infrastructure/qr/sharp-logo-compositor';
import { QrCodeOrmEntity } from '../../../infrastructure/persistence/entities/qr-code.orm-entity';
import { TypeOrmQrRepository } from '../../../infrastructure/persistence/repositories/typeorm-qr.repository';
import { QrController } from '../controllers/qr.controller';

@Module({
  imports: [TypeOrmModule.forFeature([QrCodeOrmEntity])],
  controllers: [QrController],
  providers: [
    { provide: QrRepository, useClass: TypeOrmQrRepository },
    { provide: QrStoragePort, useClass: MinioQrStorage },
    { provide: QrImageGenerator, useClass: QrcodeImageGenerator },
    { provide: LogoCompositorPort, useClass: SharpLogoCompositor },
    GenerateQrUseCase,
    AttachLogoUseCase,
    EditTargetUrlUseCase,
    ListQrUseCase,
    DeleteQrUseCase,
  ],
  exports: [QrRepository],
})
export class QrModule {}
