import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QrCode } from '../../../domain/qr/qr-code';
import { QrRepository } from '../../../domain/qr/qr.repository';
import { QrCodeOrmEntity } from '../entities/qr-code.orm-entity';

@Injectable()
export class TypeOrmQrRepository extends QrRepository {
  constructor(
    @InjectRepository(QrCodeOrmEntity)
    private readonly repository: Repository<QrCodeOrmEntity>,
  ) {
    super();
  }

  async findById(id: string): Promise<QrCode | null> {
    const row = await this.repository.findOne({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findByIdAndUserId(id: string, userId: string): Promise<QrCode | null> {
    const row = await this.repository.findOne({ where: { id, userId } });
    return row ? toDomain(row) : null;
  }

  async save(qr: QrCode): Promise<void> {
    await this.repository.save({
      id: qr.id,
      userId: qr.userId,
      contentType: qr.contentType,
      content: qr.content,
      size: qr.size,
      fgColor: qr.fgColor,
      bgColor: qr.bgColor,
      errorCorrection: qr.errorCorrection,
      scanCount: qr.scanCount,
      createdAt: qr.createdAt,
    });
  }

  async incrementScanCount(id: string): Promise<void> {
    await this.repository.increment({ id }, 'scanCount', 1);
  }
}

function toDomain(row: QrCodeOrmEntity): QrCode {
  return QrCode.create({
    id: row.id,
    userId: row.userId,
    contentType: row.contentType,
    content: row.content,
    size: row.size,
    fgColor: row.fgColor,
    bgColor: row.bgColor,
    errorCorrection: row.errorCorrection,
    scanCount: row.scanCount,
    createdAt: row.createdAt,
  });
}
