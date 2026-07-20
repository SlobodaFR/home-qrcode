import { QrCode } from '../../domain/qr/qr-code';
import { QrRepository } from '../../domain/qr/qr.repository';
import { ListQrUseCase } from './list-qr.use-case';

const qr = QrCode.create({
  id: 'qr-1', userId: 'u1', contentType: 'url', content: 'https://x.com',
  size: 1024, fgColor: '#000000', bgColor: '#FFFFFF', errorCorrection: 'M', createdAt: new Date(),
});

const makeRepo = (): jest.Mocked<QrRepository> => ({
  findById: jest.fn(),
  findByIdAndUserId: jest.fn(),
  findAllByUserId: jest.fn().mockResolvedValue({ items: [qr], total: 1 }),
  findAllLinksByUserId: jest.fn().mockResolvedValue({ items: [], total: 0 }),
  save: jest.fn(),
  deleteById: jest.fn(),
  incrementScanCount: jest.fn(),
});

describe('ListQrUseCase', () => {
  // Test 19 — TPP: constant
  it('should return paginated result from repository', async () => {
    const uc = new ListQrUseCase(makeRepo());
    const result = await uc.execute({ userId: 'u1', page: 1, limit: 20 });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  // Test 20 — TPP: variable
  it('should pass correct page and limit to repository', async () => {
    const repo = makeRepo();
    await new ListQrUseCase(repo).execute({ userId: 'u1', page: 3, limit: 10 });
    expect(repo.findAllByUserId).toHaveBeenCalledWith('u1', { page: 3, limit: 10 });
  });
});
