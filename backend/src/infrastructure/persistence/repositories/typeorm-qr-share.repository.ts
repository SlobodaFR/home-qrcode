import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { QrCode } from '../../../domain/qr/qr-code';
import { QrShare } from '../../../domain/qr/qr-share';
import { QrShareRepository } from '../../../domain/qr/qr-share.repository';
import { QrCodeOrmEntity } from '../entities/qr-code.orm-entity';
import { QrShareOrmEntity } from '../entities/qr-share.orm-entity';

@Injectable()
export class TypeOrmQrShareRepository extends QrShareRepository {
  constructor(
    @InjectRepository(QrShareOrmEntity)
    private readonly shareRepository: Repository<QrShareOrmEntity>,
    @InjectRepository(QrCodeOrmEntity)
    private readonly qrRepository: Repository<QrCodeOrmEntity>,
  ) {
    super();
  }

  async save(share: QrShare): Promise<void> {
    await this.shareRepository.save({
      id: share.id,
      qrId: share.qrId,
      ownerId: share.ownerId,
      recipientId: share.recipientId,
      createdAt: share.createdAt,
    });
  }

  async findById(shareId: string): Promise<QrShare | null> {
    const row = await this.shareRepository.findOne({ where: { id: shareId } });
    return row ? toDomain(row) : null;
  }

  async findByQrAndRecipient(qrId: string, recipientId: string): Promise<QrShare | null> {
    const row = await this.shareRepository.findOne({ where: { qrId, recipientId } });
    return row ? toDomain(row) : null;
  }

  async findByQrIds(qrIds: string[]): Promise<QrShare[]> {
    if (qrIds.length === 0) return [];
    const rows = await this.shareRepository.find({ where: { qrId: In(qrIds) } });
    return rows.map(toDomain);
  }

  async findWithQrByRecipientId(recipientId: string): Promise<{ share: QrShare; qrCode: QrCode }[]> {
    const shares = await this.shareRepository.find({
      where: { recipientId },
      order: { createdAt: 'DESC' },
    });
    if (shares.length === 0) return [];
    const qrIds = shares.map((s) => s.qrId);
    const qrs = await this.qrRepository.find({ where: { id: In(qrIds) } });
    const qrMap = new Map(qrs.map((q) => [q.id, q]));
    return shares
      .filter((s) => qrMap.has(s.qrId))
      .map((s) => ({ share: toDomain(s), qrCode: toDomainQr(qrMap.get(s.qrId)!) }));
  }

  async deleteById(shareId: string): Promise<void> {
    await this.shareRepository.delete({ id: shareId });
  }

  async deleteByQrId(qrId: string): Promise<void> {
    await this.shareRepository.delete({ qrId });
  }
}

function toDomain(row: QrShareOrmEntity): QrShare {
  return QrShare.create({ id: row.id, qrId: row.qrId, ownerId: row.ownerId, recipientId: row.recipientId, createdAt: row.createdAt });
}

function toDomainQr(row: QrCodeOrmEntity): QrCode {
  return QrCode.create({
    id: row.id, userId: row.userId, contentType: row.contentType, content: row.content,
    encodedContent: row.encodedContent, hasLogo: row.hasLogo, logoMimeType: row.logoMimeType,
    source: row.source, expiresAt: row.expiresAt ?? null, size: row.size, fgColor: row.fgColor,
    bgColor: row.bgColor, errorCorrection: row.errorCorrection, scanCount: row.scanCount, createdAt: row.createdAt,
  });
}
