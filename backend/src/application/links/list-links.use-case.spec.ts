import { QrCode } from '../../domain/qr/qr-code';
import { QrRepository } from '../../domain/qr/qr.repository';
import { ListLinksUseCase } from './list-links.use-case';

const makeLink = () => QrCode.create({
  id: 'sl-1', userId: 'u1', contentType: 'url', content: 'https://t.com',
  source: 'shortlink', size: 0, fgColor: '', bgColor: '', errorCorrection: 'M',
  createdAt: new Date(),
});

const makeRepo = (): jest.Mocked<QrRepository> => ({
  findById: jest.fn(),
  findByIdAndUserId: jest.fn(),
  findAllByUserId: jest.fn(),
  findAllLinksByUserId: jest.fn().mockResolvedValue({ items: [makeLink()], total: 1 }),
  save: jest.fn(),
  deleteById: jest.fn(),
  incrementScanCount: jest.fn(),
});

describe('ListLinksUseCase', () => {
  // url-shortener: Test 9 — TPP: constant
  it('should call findAllLinksByUserId with userId and pagination options', async () => {
    const repo = makeRepo();
    const uc = new ListLinksUseCase(repo);
    await uc.execute({ userId: 'u1', page: 2, limit: 10 });
    expect(repo.findAllLinksByUserId).toHaveBeenCalledWith('u1', { page: 2, limit: 10 });
  });

  // url-shortener: Test 10 — TPP: variable
  it('should return result with page and limit echoed back alongside items', async () => {
    const uc = new ListLinksUseCase(makeRepo());
    const result = await uc.execute({ userId: 'u1', page: 2, limit: 10 });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
  });
});
