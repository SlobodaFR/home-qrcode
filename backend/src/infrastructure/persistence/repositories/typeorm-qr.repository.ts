import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { QrCode } from '../../../domain/qr/qr-code';
import { FindAllOptions, FindAllResult, QrRepository } from '../../../domain/qr/qr.repository';
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
      encodedContent: qr.encodedContent,
      hasLogo: qr.hasLogo,
      logoMimeType: qr.logoMimeType,
      source: qr.source,
      expiresAt: qr.expiresAt,
      size: qr.size,
      fgColor: qr.fgColor,
      bgColor: qr.bgColor,
      errorCorrection: qr.errorCorrection,
      scanCount: qr.scanCount,
      createdAt: qr.createdAt,
    });
  }

  async findAllByUserId(userId: string, options: FindAllOptions): Promise<FindAllResult> {
    const [rows, total] = await this.repository.findAndCount({
      where: [
        { userId, source: IsNull() },
        { userId, source: Not('shortlink') },
      ],
      order: { createdAt: 'DESC' },
      skip: (options.page - 1) * options.limit,
      take: options.limit,
    });
    return { items: rows.map(toDomain), total };
  }

  async findAllLinksByUserId(userId: string, options: FindAllOptions): Promise<FindAllResult> {
    const [rows, total] = await this.repository.findAndCount({
      where: { userId, source: 'shortlink' },
      order: { createdAt: 'DESC' },
      skip: (options.page - 1) * options.limit,
      take: options.limit,
    });
    return { items: rows.map(toDomain), total };
  }

  async deleteById(id: string, userId: string): Promise<boolean> {
    const result = await this.repository.delete({ id, userId });
    return (result.affected ?? 0) > 0;
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
    encodedContent: row.encodedContent,
    hasLogo: row.hasLogo,
    logoMimeType: row.logoMimeType,
    source: row.source,
    expiresAt: row.expiresAt ?? null,
    size: row.size,
    fgColor: row.fgColor,
    bgColor: row.bgColor,
    errorCorrection: row.errorCorrection,
    scanCount: row.scanCount,
    createdAt: row.createdAt,
  });
}
