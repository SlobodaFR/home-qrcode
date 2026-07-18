import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GenerateQrUseCase } from '../../../application/qr/generate-qr.use-case';
import { QrImageGenerator } from '../../../domain/qr/qr-image-generator';
import { QrRepository } from '../../../domain/qr/qr.repository';
import { QrStoragePort } from '../../../domain/qr/qr-storage.port';
import { MinioQrStorage } from '../../../infrastructure/qr/minio-qr-storage';
import { QrcodeImageGenerator } from '../../../infrastructure/qr/qrcode-image-generator';
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
    GenerateQrUseCase,
  ],
  exports: [QrRepository],
})
export class QrModule {}
