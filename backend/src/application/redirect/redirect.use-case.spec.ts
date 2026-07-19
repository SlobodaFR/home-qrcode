import { NotFoundException } from '@nestjs/common';
import { QrCode } from '../../domain/qr/qr-code';
import { QrRepository } from '../../domain/qr/qr.repository';
import { RedirectUseCase } from './redirect.use-case';

const makeRepo = (qr: QrCode | null = null): jest.Mocked<QrRepository> => ({
  findById: jest.fn().mockResolvedValue(qr),
  findByIdAndUserId: jest.fn(),
  findAllByUserId: jest.fn(),
  save: jest.fn(),
  deleteById: jest.fn(),
  incrementScanCount: jest.fn().mockResolvedValue(undefined),
});

const urlQr = QrCode.create({
  id: 'qr-1', userId: 'u1', contentType: 'url', content: 'https://target.com',
  size: 1024, fgColor: '#000000', bgColor: '#FFFFFF', errorCorrection: 'M',
  createdAt: new Date(),
});

const textQr = QrCode.create({
  id: 'qr-2', userId: 'u1', contentType: 'text', content: 'Hello world',
  size: 1024, fgColor: '#000000', bgColor: '#FFFFFF', errorCorrection: 'M',
  createdAt: new Date(),
});

describe('RedirectUseCase', () => {
  // Test 10 — TPP: constant
  it('should return targetUrl for a url-type QrCode', async () => {
    const uc = new RedirectUseCase(makeRepo(urlQr));
    const result = await uc.execute({ id: 'qr-1' });
    expect(result.targetUrl).toBe('https://target.com');
  });

  // Test 11 — TPP: variable
  it('should call incrementScanCount fire-and-forget (void, no await required)', async () => {
    const repo = makeRepo(urlQr);
    const uc = new RedirectUseCase(repo);
    await uc.execute({ id: 'qr-1' });
    // incrementScanCount is called (fire-and-forget), not awaited before return
    // Allow microtask queue to drain so the void call has had a chance to run
    await Promise.resolve();
    expect(repo.incrementScanCount).toHaveBeenCalledWith('qr-1');
  });

  // Test 12 — TPP: conditional
  it('should throw NotFoundException when id not found', async () => {
    const uc = new RedirectUseCase(makeRepo(null));
    await expect(uc.execute({ id: 'missing' })).rejects.toThrow(NotFoundException);
  });

  // Test 13 — TPP: conditional
  it('should throw NotFoundException for text-type QrCode', async () => {
    const uc = new RedirectUseCase(makeRepo(textQr));
    await expect(uc.execute({ id: 'qr-2' })).rejects.toThrow(NotFoundException);
  });
});
