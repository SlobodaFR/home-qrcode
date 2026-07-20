import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { QrCode } from '../../domain/qr/qr-code';
import { QrRepository } from '../../domain/qr/qr.repository';
import { QrShare } from '../../domain/qr/qr-share';
import { QrShareRepository } from '../../domain/qr/qr-share.repository';
import { User } from '../../domain/user/user';
import { UserRepository } from '../../domain/user/user.repository';
import { ShareQrUseCase } from './share-qr.use-case';

const makeQr = (userId = 'owner-1') => QrCode.create({
  id: 'qr-1', userId, contentType: 'url', content: 'https://x.com',
  size: 1024, fgColor: '#000', bgColor: '#fff', errorCorrection: 'M', createdAt: new Date(),
});

const makeUser = (id = 'recipient-1') => User.create({
  id, email: `${id}@example.com`, name: 'Bob', avatarUrl: '', createdAt: new Date(),
});

const makeQrRepo = (qr: QrCode | null): jest.Mocked<QrRepository> => ({
  findById: jest.fn().mockResolvedValue(qr),
  findByIdAndUserId: jest.fn(),
  findAllByUserId: jest.fn(),
  findAllLinksByUserId: jest.fn(),
  save: jest.fn(),
  deleteById: jest.fn(),
  incrementScanCount: jest.fn(),
});

const makeShareRepo = (existing: QrShare | null = null): jest.Mocked<QrShareRepository> => ({
  save: jest.fn().mockResolvedValue(undefined),
  findById: jest.fn(),
  findByQrAndRecipient: jest.fn().mockResolvedValue(existing),
  findByQrIds: jest.fn(),
  findWithQrByRecipientId: jest.fn(),
  deleteById: jest.fn(),
  deleteByQrId: jest.fn(),
});

const makeUserRepo = (user: User | null): jest.Mocked<UserRepository> => ({
  findById: jest.fn().mockResolvedValue(user),
  findByEmail: jest.fn(),
  findAll: jest.fn(),
  save: jest.fn(),
});

describe('ShareQrUseCase', () => {
  // T2 — TPP: constant
  it('should call qrShareRepository.save() and return the share when all checks pass', async () => {
    const uc = new ShareQrUseCase(makeQrRepo(makeQr()), makeShareRepo(), makeUserRepo(makeUser()));
    const { share } = await uc.execute({ qrId: 'qr-1', ownerId: 'owner-1', recipientId: 'recipient-1' });
    expect(share.qrId).toBe('qr-1');
    expect(share.ownerId).toBe('owner-1');
    expect(share.recipientId).toBe('recipient-1');
  });

  // T3 — TPP: conditional
  it('should throw NotFoundException when QR does not exist', async () => {
    const uc = new ShareQrUseCase(makeQrRepo(null), makeShareRepo(), makeUserRepo(makeUser()));
    await expect(uc.execute({ qrId: 'qr-1', ownerId: 'owner-1', recipientId: 'recipient-1' })).rejects.toThrow(NotFoundException);
  });

  // T4 — TPP: conditional
  it('should throw ForbiddenException when caller is not the QR owner', async () => {
    const uc = new ShareQrUseCase(makeQrRepo(makeQr('other-owner')), makeShareRepo(), makeUserRepo(makeUser()));
    await expect(uc.execute({ qrId: 'qr-1', ownerId: 'owner-1', recipientId: 'recipient-1' })).rejects.toThrow(ForbiddenException);
  });

  // T5 — TPP: conditional
  it('should throw BadRequestException when ownerId equals recipientId', async () => {
    const uc = new ShareQrUseCase(makeQrRepo(makeQr('owner-1')), makeShareRepo(), makeUserRepo(makeUser()));
    await expect(uc.execute({ qrId: 'qr-1', ownerId: 'owner-1', recipientId: 'owner-1' })).rejects.toThrow(BadRequestException);
  });

  // T6 — TPP: conditional
  it('should throw NotFoundException when recipient user does not exist', async () => {
    const uc = new ShareQrUseCase(makeQrRepo(makeQr()), makeShareRepo(), makeUserRepo(null));
    await expect(uc.execute({ qrId: 'qr-1', ownerId: 'owner-1', recipientId: 'recipient-1' })).rejects.toThrow(NotFoundException);
  });

  // T7 — TPP: conditional
  it('should throw ConflictException when share already exists', async () => {
    const existingShare = QrShare.create({ id: 'sh-x', qrId: 'qr-1', ownerId: 'owner-1', recipientId: 'recipient-1', createdAt: new Date() });
    const uc = new ShareQrUseCase(makeQrRepo(makeQr()), makeShareRepo(existingShare), makeUserRepo(makeUser()));
    await expect(uc.execute({ qrId: 'qr-1', ownerId: 'owner-1', recipientId: 'recipient-1' })).rejects.toThrow(ConflictException);
  });
});
