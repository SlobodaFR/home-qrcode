import { QrCode } from '../../domain/qr/qr-code';
import { QrShare } from '../../domain/qr/qr-share';
import { QrShareRepository } from '../../domain/qr/qr-share.repository';
import { User } from '../../domain/user/user';
import { UserRepository } from '../../domain/user/user.repository';
import { ListSharedWithMeUseCase } from './list-shared-with-me.use-case';

const makeQr = (id = 'qr-1', userId = 'owner-1') => QrCode.create({
  id, userId, contentType: 'url', content: 'https://x.com',
  size: 1024, fgColor: '#000', bgColor: '#fff', errorCorrection: 'M', createdAt: new Date(),
});

const makeShare = (qrId = 'qr-1', ownerId = 'owner-1') =>
  QrShare.create({ id: 'sh-1', qrId, ownerId, recipientId: 'me', createdAt: new Date() });

const makeShareRepo = (items: { share: QrShare; qrCode: QrCode }[]): jest.Mocked<QrShareRepository> => ({
  save: jest.fn(),
  findById: jest.fn(),
  findByQrAndRecipient: jest.fn(),
  findByQrIds: jest.fn(),
  findWithQrByRecipientId: jest.fn().mockResolvedValue(items),
  deleteById: jest.fn(),
  deleteByQrId: jest.fn(),
});

const makeUserRepo = (users: User[]): jest.Mocked<UserRepository> => ({
  findById: jest.fn(),
  findByEmail: jest.fn(),
  findAll: jest.fn().mockResolvedValue(users),
  save: jest.fn(),
});

describe('ListSharedWithMeUseCase', () => {
  // T11 — TPP: constant
  it('should return empty array when no shares exist', async () => {
    const uc = new ListSharedWithMeUseCase(makeShareRepo([]), makeUserRepo([]));
    const result = await uc.execute({ userId: 'me' });
    expect(result.items).toHaveLength(0);
  });

  // T12 — TPP: collection
  it('should return items with qrCode and sharedBy when shares exist', async () => {
    const owner = User.create({ id: 'owner-1', email: 'owner@x.com', name: 'Alice', avatarUrl: '', createdAt: new Date() });
    const uc = new ListSharedWithMeUseCase(
      makeShareRepo([{ share: makeShare(), qrCode: makeQr() }]),
      makeUserRepo([owner]),
    );
    const result = await uc.execute({ userId: 'me' });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].qrCode.id).toBe('qr-1');
    expect(result.items[0].sharedBy.id).toBe('owner-1');
    expect(result.items[0].sharedBy.name).toBe('Alice');
  });
});
