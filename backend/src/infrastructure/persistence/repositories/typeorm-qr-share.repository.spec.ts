import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QrCode } from '../../../domain/qr/qr-code';
import { QrShare } from '../../../domain/qr/qr-share';
import { QrCodeOrmEntity } from '../entities/qr-code.orm-entity';
import { QrShareOrmEntity } from '../entities/qr-share.orm-entity';
import { UserOrmEntity } from '../entities/user.orm-entity';
import { RevokedSessionOrmEntity } from '../entities/revoked-session.orm-entity';
import { TypeOrmQrShareRepository } from './typeorm-qr-share.repository';
import { TypeOrmQrRepository } from './typeorm-qr.repository';

const makeQr = (id = 'qr-1', userId = 'user-1') => QrCode.create({
  id, userId, contentType: 'url', content: 'https://x.com',
  size: 1024, fgColor: '#000', bgColor: '#fff', errorCorrection: 'M', createdAt: new Date('2026-01-01'),
});

const makeShare = (overrides: Partial<{ id: string; qrId: string; recipientId: string; ownerId: string }> = {}) =>
  QrShare.create({
    id: overrides.id ?? 'sh-1',
    qrId: overrides.qrId ?? 'qr-1',
    ownerId: overrides.ownerId ?? 'owner-1',
    recipientId: overrides.recipientId ?? 'recipient-1',
    createdAt: new Date('2026-06-01'),
  });

describe('TypeOrmQrShareRepository', () => {
  let shareRepo: TypeOrmQrShareRepository;
  let qrRepo: TypeOrmQrRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [UserOrmEntity, RevokedSessionOrmEntity, QrCodeOrmEntity, QrShareOrmEntity],
          synchronize: true,
          enableWAL: false,
        }),
        TypeOrmModule.forFeature([QrCodeOrmEntity, QrShareOrmEntity]),
      ],
      providers: [TypeOrmQrShareRepository, TypeOrmQrRepository],
    }).compile();
    shareRepo = module.get(TypeOrmQrShareRepository);
    qrRepo = module.get(TypeOrmQrRepository);
  });

  // T15 — TPP: constant
  it('save() then findById() should round-trip a QrShare', async () => {
    await qrRepo.save(makeQr());
    const share = makeShare();
    await shareRepo.save(share);
    const found = await shareRepo.findById('sh-1');
    expect(found).not.toBeNull();
    expect(found!.id).toBe('sh-1');
    expect(found!.qrId).toBe('qr-1');
    expect(found!.ownerId).toBe('owner-1');
    expect(found!.recipientId).toBe('recipient-1');
  });

  // T16 — TPP: conditional
  it('findById() should return null when share does not exist', async () => {
    expect(await shareRepo.findById('missing')).toBeNull();
  });

  // T17 — TPP: variable
  it('findByQrAndRecipient() should return share when found', async () => {
    await qrRepo.save(makeQr());
    await shareRepo.save(makeShare());
    const found = await shareRepo.findByQrAndRecipient('qr-1', 'recipient-1');
    expect(found).not.toBeNull();
    expect(found!.id).toBe('sh-1');
  });

  // T18 — TPP: conditional
  it('findByQrAndRecipient() should return null when no match', async () => {
    expect(await shareRepo.findByQrAndRecipient('qr-1', 'nobody')).toBeNull();
  });

  // T19 — TPP: collection
  it('findByQrIds() should return shares for given QR ids and empty array when input is empty', async () => {
    await qrRepo.save(makeQr('qr-1'));
    await qrRepo.save(makeQr('qr-2'));
    await shareRepo.save(makeShare({ id: 'sh-1', qrId: 'qr-1', recipientId: 'r-1' }));
    await shareRepo.save(makeShare({ id: 'sh-2', qrId: 'qr-2', recipientId: 'r-2' }));
    const found = await shareRepo.findByQrIds(['qr-1', 'qr-2']);
    expect(found).toHaveLength(2);
    const empty = await shareRepo.findByQrIds([]);
    expect(empty).toHaveLength(0);
  });

  // T20 — TPP: collection
  it('findWithQrByRecipientId() should return {share, qrCode} joined by qr_id', async () => {
    await qrRepo.save(makeQr('qr-1', 'owner-1'));
    await shareRepo.save(makeShare({ id: 'sh-1', qrId: 'qr-1', ownerId: 'owner-1', recipientId: 'me' }));
    const rows = await shareRepo.findWithQrByRecipientId('me');
    expect(rows).toHaveLength(1);
    expect(rows[0].share.id).toBe('sh-1');
    expect(rows[0].qrCode.id).toBe('qr-1');
  });

  // T21 — TPP: variable
  it('deleteById() should remove the share', async () => {
    await qrRepo.save(makeQr());
    await shareRepo.save(makeShare());
    await shareRepo.deleteById('sh-1');
    expect(await shareRepo.findById('sh-1')).toBeNull();
  });

  // T22 — TPP: collection
  it('deleteByQrId() should remove all shares for that QR', async () => {
    await qrRepo.save(makeQr());
    await shareRepo.save(makeShare({ id: 'sh-1', recipientId: 'r-1' }));
    await shareRepo.save(makeShare({ id: 'sh-2', recipientId: 'r-2' }));
    await shareRepo.deleteByQrId('qr-1');
    expect(await shareRepo.findByQrIds(['qr-1'])).toHaveLength(0);
  });

  // T23 — TPP: conditional
  it('save() with duplicate (qrId, recipientId) should throw a unique constraint error', async () => {
    await qrRepo.save(makeQr());
    await shareRepo.save(makeShare({ id: 'sh-1', recipientId: 'r-1' }));
    await expect(shareRepo.save(makeShare({ id: 'sh-2', recipientId: 'r-1' }))).rejects.toThrow();
  });
});
