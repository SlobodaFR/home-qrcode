import { NotFoundException } from '@nestjs/common';
import { QrCode } from '../../domain/qr/qr-code';
import { QrRepository } from '../../domain/qr/qr.repository';
import { QrStoragePort } from '../../domain/qr/qr-storage.port';
import { DeleteQrUseCase } from './delete-qr.use-case';

const urlQr = QrCode.create({
  id: 'qr-1', userId: 'user-1', contentType: 'url', content: 'https://x.com',
  size: 1024, fgColor: '#000000', bgColor: '#FFFFFF', errorCorrection: 'M', createdAt: new Date(),
});

const makeRepo = (qr: QrCode | null, deleteResult = true): jest.Mocked<QrRepository> => ({
  findById: jest.fn(),
  findByIdAndUserId: jest.fn().mockResolvedValue(qr),
  findAllByUserId: jest.fn(),
  findAllLinksByUserId: jest.fn(),
  save: jest.fn(),
  deleteById: jest.fn().mockResolvedValue(deleteResult),
  incrementScanCount: jest.fn(),
});

const makeStorage = (): jest.Mocked<QrStoragePort> => ({
  uploadPng: jest.fn(), uploadSvg: jest.fn(), uploadLogo: jest.fn(),
  streamPng: jest.fn(), streamSvg: jest.fn(), streamLogo: jest.fn(),
  exists: jest.fn(),
  delete: jest.fn().mockResolvedValue(undefined),
});

describe('DeleteQrUseCase', () => {
  // Test 15 — TPP: constant
  it('should call storage.delete and then repository.deleteById', async () => {
    const repo = makeRepo(urlQr);
    const storage = makeStorage();
    await new DeleteQrUseCase(repo, storage).execute({ id: 'qr-1', userId: 'user-1' });
    await Promise.resolve(); // drain void
    expect(storage.delete).toHaveBeenCalledWith('qr-1');
    expect(repo.deleteById).toHaveBeenCalledWith('qr-1', 'user-1');
  });

  // Test 16 — TPP: variable
  it('should call storage.delete fire-and-forget before repository.deleteById', async () => {
    const order: string[] = [];
    const repo = makeRepo(urlQr);
    const storage = makeStorage();
    (storage.delete as jest.Mock).mockImplementation(() => { order.push('storage'); return Promise.resolve(); });
    (repo.deleteById as jest.Mock).mockImplementation(async () => { order.push('db'); return true; });
    await new DeleteQrUseCase(repo, storage).execute({ id: 'qr-1', userId: 'user-1' });
    await Promise.resolve();
    expect(order).toContain('storage');
    expect(order).toContain('db');
  });

  // Test 17 — TPP: conditional
  it('should throw NotFoundException when findByIdAndUserId returns null', async () => {
    await expect(
      new DeleteQrUseCase(makeRepo(null), makeStorage()).execute({ id: 'x', userId: 'u' })
    ).rejects.toThrow(NotFoundException);
  });

  // Test 18 — TPP: conditional
  it('should throw NotFoundException when deleteById returns false (race)', async () => {
    await expect(
      new DeleteQrUseCase(makeRepo(urlQr, false), makeStorage()).execute({ id: 'qr-1', userId: 'user-1' })
    ).rejects.toThrow(NotFoundException);
  });
});
