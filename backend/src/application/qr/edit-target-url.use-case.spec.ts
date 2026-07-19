import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { QrCode } from '../../domain/qr/qr-code';
import { QrRepository } from '../../domain/qr/qr.repository';
import { EditTargetUrlUseCase } from './edit-target-url.use-case';

const makeRepo = (qr: QrCode | null = null): jest.Mocked<QrRepository> => ({
  findById: jest.fn(),
  findByIdAndUserId: jest.fn().mockResolvedValue(qr),
  save: jest.fn().mockResolvedValue(undefined),
  incrementScanCount: jest.fn(),
});

const urlQr = QrCode.create({
  id: 'qr-1', userId: 'user-1', contentType: 'url', content: 'https://old.com',
  size: 1024, fgColor: '#000000', bgColor: '#FFFFFF', errorCorrection: 'M',
  createdAt: new Date(), scanCount: 5,
});

const textQr = QrCode.create({
  id: 'qr-2', userId: 'user-1', contentType: 'text', content: 'Hello world',
  size: 1024, fgColor: '#000000', bgColor: '#FFFFFF', errorCorrection: 'M',
  createdAt: new Date(),
});

describe('EditTargetUrlUseCase', () => {
  // Test 14 — TPP: constant
  it('should return updated QrCode with new content', async () => {
    const uc = new EditTargetUrlUseCase(makeRepo(urlQr));
    const result = await uc.execute({ id: 'qr-1', userId: 'user-1', content: 'https://new.com' });
    expect(result.qr.content).toBe('https://new.com');
    expect(result.qr).toBeInstanceOf(QrCode);
  });

  // Test 15 — TPP: variable
  it('should call repository.save with the updated entity', async () => {
    const repo = makeRepo(urlQr);
    const uc = new EditTargetUrlUseCase(repo);
    await uc.execute({ id: 'qr-1', userId: 'user-1', content: 'https://new.com' });
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ content: 'https://new.com' }));
  });

  // Test 16 — TPP: conditional
  it('should throw NotFoundException when QR not found or not owned', async () => {
    const uc = new EditTargetUrlUseCase(makeRepo(null));
    await expect(uc.execute({ id: 'missing', userId: 'user-1', content: 'https://x.com' })).rejects.toThrow(NotFoundException);
  });

  // Test 17 — TPP: conditional
  it('should throw UnprocessableEntityException for text-type QrCode', async () => {
    const uc = new EditTargetUrlUseCase(makeRepo(textQr));
    await expect(uc.execute({ id: 'qr-2', userId: 'user-1', content: 'https://x.com' })).rejects.toThrow(UnprocessableEntityException);
  });
});
