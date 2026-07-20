import { QrCode } from '../../domain/qr/qr-code';
import { QrRepository } from '../../domain/qr/qr.repository';
import { CreateLinkUseCase } from './create-link.use-case';

const makeRepo = (): jest.Mocked<QrRepository> => ({
  findById: jest.fn(),
  findByIdAndUserId: jest.fn(),
  findAllByUserId: jest.fn(),
  findAllLinksByUserId: jest.fn(),
  save: jest.fn().mockResolvedValue(undefined),
  deleteById: jest.fn(),
  incrementScanCount: jest.fn(),
});

describe('CreateLinkUseCase', () => {
  // url-shortener: Test 5 — TPP: constant
  it('should call repository.save with a QrCode', async () => {
    const repo = makeRepo();
    const uc = new CreateLinkUseCase(repo);
    await uc.execute({ userId: 'u1', url: 'https://target.com' });
    expect(repo.save).toHaveBeenCalledWith(expect.any(QrCode));
  });

  // url-shortener: Test 6 — TPP: variable
  it('should return a QrCode with source=shortlink and contentType=url', async () => {
    const uc = new CreateLinkUseCase(makeRepo());
    const { link } = await uc.execute({ userId: 'u1', url: 'https://target.com' });
    expect(link.source).toBe('shortlink');
    expect(link.contentType).toBe('url');
  });

  // url-shortener: Test 7 — TPP: variable
  it('should store the provided url as content', async () => {
    const uc = new CreateLinkUseCase(makeRepo());
    const { link } = await uc.execute({ userId: 'u1', url: 'https://target.com' });
    expect(link.content).toBe('https://target.com');
  });

  // url-shortener: Test 8 — TPP: variable
  it('should set sentinel values (size=0, fgColor="", bgColor="", errorCorrection="M")', async () => {
    const uc = new CreateLinkUseCase(makeRepo());
    const { link } = await uc.execute({ userId: 'u1', url: 'https://target.com' });
    expect(link.size).toBe(0);
    expect(link.fgColor).toBe('');
    expect(link.bgColor).toBe('');
    expect(link.errorCorrection).toBe('M');
  });

  // link-expiration: Test 17 — TPP: constant
  it('should create link with expiresAt=null when not provided in command', async () => {
    const repo = makeRepo();
    const uc = new CreateLinkUseCase(repo);
    await uc.execute({ userId: 'u1', url: 'https://target.com' });
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ expiresAt: null }));
  });

  // link-expiration: Test 18 — TPP: variable
  it('should create link with the provided expiresAt Date', async () => {
    const repo = makeRepo();
    const uc = new CreateLinkUseCase(repo);
    const expiry = new Date('2026-08-25T23:59:59.000Z');
    await uc.execute({ userId: 'u1', url: 'https://target.com', expiresAt: expiry });
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ expiresAt: expiry }));
  });
});
