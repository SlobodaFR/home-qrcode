import { NotFoundException } from '@nestjs/common';
import { QrShare } from '../../domain/qr/qr-share';
import { QrShareRepository } from '../../domain/qr/qr-share.repository';
import { UnshareQrUseCase } from './unshare-qr.use-case';

const makeShare = (overrides: Partial<{ qrId: string; ownerId: string }> = {}) =>
  QrShare.create({ id: 'sh-1', qrId: overrides.qrId ?? 'qr-1', ownerId: overrides.ownerId ?? 'owner-1', recipientId: 'u-2', createdAt: new Date() });

const makeRepo = (share: QrShare | null): jest.Mocked<QrShareRepository> => ({
  save: jest.fn(),
  findById: jest.fn().mockResolvedValue(share),
  findByQrAndRecipient: jest.fn(),
  findByQrIds: jest.fn(),
  findWithQrByRecipientId: jest.fn(),
  deleteById: jest.fn().mockResolvedValue(undefined),
  deleteByQrId: jest.fn(),
});

describe('UnshareQrUseCase', () => {
  // T8 — TPP: constant
  it('should call qrShareRepository.deleteById() when share found and ownership matches', async () => {
    const repo = makeRepo(makeShare());
    await new UnshareQrUseCase(repo).execute({ shareId: 'sh-1', qrId: 'qr-1', ownerId: 'owner-1' });
    expect(repo.deleteById).toHaveBeenCalledWith('sh-1');
  });

  // T9 — TPP: conditional
  it('should throw NotFoundException when share does not exist', async () => {
    await expect(
      new UnshareQrUseCase(makeRepo(null)).execute({ shareId: 'sh-x', qrId: 'qr-1', ownerId: 'owner-1' })
    ).rejects.toThrow(NotFoundException);
  });

  // T10 — TPP: conditional
  it('should throw NotFoundException when qrId or ownerId does not match the share', async () => {
    const repo = makeRepo(makeShare({ qrId: 'qr-1', ownerId: 'owner-1' }));
    await expect(
      new UnshareQrUseCase(repo).execute({ shareId: 'sh-1', qrId: 'WRONG-QR', ownerId: 'owner-1' })
    ).rejects.toThrow(NotFoundException);

    const repo2 = makeRepo(makeShare({ qrId: 'qr-1', ownerId: 'owner-1' }));
    await expect(
      new UnshareQrUseCase(repo2).execute({ shareId: 'sh-1', qrId: 'qr-1', ownerId: 'WRONG-OWNER' })
    ).rejects.toThrow(NotFoundException);
  });
});
