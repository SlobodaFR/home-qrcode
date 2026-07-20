import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreateLinkUseCase } from '../../../application/links/create-link.use-case';
import { DeleteLinkUseCase } from '../../../application/links/delete-link.use-case';
import { EditLinkUseCase } from '../../../application/links/edit-link.use-case';
import { ListLinksUseCase } from '../../../application/links/list-links.use-case';
import { QrRepository } from '../../../domain/qr/qr.repository';
import { QrCodeOrmEntity } from '../../../infrastructure/persistence/entities/qr-code.orm-entity';
import { TypeOrmQrRepository } from '../../../infrastructure/persistence/repositories/typeorm-qr.repository';
import { LinksController } from '../controllers/links.controller';

@Module({
  imports: [TypeOrmModule.forFeature([QrCodeOrmEntity])],
  controllers: [LinksController],
  providers: [
    { provide: QrRepository, useClass: TypeOrmQrRepository },
    CreateLinkUseCase,
    ListLinksUseCase,
    EditLinkUseCase,
    DeleteLinkUseCase,
  ],
})
export class LinksModule {}
