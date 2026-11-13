import type { Mock, Mocked } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { QrCode } from '../../domain/qr/qr-code';
import { QrRepository } from '../../domain/qr/qr.repository';
import { QrShareRepository } from '../../domain/qr/qr-share.repository';
import { QrStoragePort } from '../../domain/qr/qr-storage.port';
import { DeleteQrUseCase } from './delete-qr.use-case';

const urlQr = QrCode.create({
  id: 'qr-1', userId: 'user-1', contentType: 'url', content: 'https://x.com',
  size: 1024, fgColor: '#000000', bgColor: '#FFFFFF', errorCorrection: 'M', createdAt: new Date(),
});

const makeShareRepo = (): Mocked<QrShareRepository> => ({
  save: vi.fn(), findById: vi.fn(), findByQrAndRecipient: vi.fn(),
  findByQrIds: vi.fn(), findWithQrByRecipientId: vi.fn(),
  deleteById: vi.fn(), deleteByQrId: vi.fn().mockResolvedValue(undefined),
});

const makeRepo = (qr: QrCode | null, deleteResult = true): Mocked<QrRepository> => ({
  findById: vi.fn(),
  findByIdAndUserId: vi.fn().mockResolvedValue(qr),
  findAllByUserId: vi.fn(),
  findAllLinksByUserId: vi.fn(),
  save: vi.fn(),
  deleteById: vi.fn().mockResolvedValue(deleteResult),
  incrementScanCount: vi.fn(),
});

const makeStorage = (): Mocked<QrStoragePort> => ({
  uploadPng: vi.fn(), uploadSvg: vi.fn(), uploadLogo: vi.fn(),
  streamPng: vi.fn(), streamSvg: vi.fn(), streamLogo: vi.fn(),
  exists: vi.fn(),
  delete: vi.fn().mockResolvedValue(undefined),
});

describe('DeleteQrUseCase', () => {
  // T14 — TPP: variable (internal-sharing cascade)
  it('should call qrShareRepository.deleteByQrId() before deleting the QR', async () => {
    const repo = makeRepo(urlQr);
    const storage = makeStorage();
    const shareRepo = makeShareRepo();
    const deleteOrder: string[] = [];
    (shareRepo.deleteByQrId as Mock).mockImplementation(async () => { deleteOrder.push('shares'); });
    (repo.deleteById as Mock).mockImplementation(async () => { deleteOrder.push('qr'); return true; });
    await new DeleteQrUseCase(repo, storage, shareRepo).execute({ id: 'qr-1', userId: 'user-1' });
    expect(shareRepo.deleteByQrId).toHaveBeenCalledWith('qr-1');
    expect(deleteOrder.indexOf('shares')).toBeLessThan(deleteOrder.indexOf('qr'));
  });

  // Test 15 — TPP: constant
  it('should call storage.delete and then repository.deleteById', async () => {
    const repo = makeRepo(urlQr);
    const storage = makeStorage();
    await new DeleteQrUseCase(repo, storage, makeShareRepo()).execute({ id: 'qr-1', userId: 'user-1' });
    await Promise.resolve(); // drain void
    expect(storage.delete).toHaveBeenCalledWith('qr-1');
    expect(repo.deleteById).toHaveBeenCalledWith('qr-1', 'user-1');
  });

  // Test 16 — TPP: variable
  it('should call storage.delete fire-and-forget before repository.deleteById', async () => {
    const order: string[] = [];
    const repo = makeRepo(urlQr);
    const storage = makeStorage();
    (storage.delete as Mock).mockImplementation(() => { order.push('storage'); return Promise.resolve(); });
    (repo.deleteById as Mock).mockImplementation(async () => { order.push('db'); return true; });
    await new DeleteQrUseCase(repo, storage, makeShareRepo()).execute({ id: 'qr-1', userId: 'user-1' });
    await Promise.resolve();
    expect(order).toContain('storage');
    expect(order).toContain('db');
  });

  // Test 17 — TPP: conditional
  it('should throw NotFoundException when findByIdAndUserId returns null', async () => {
    await expect(
      new DeleteQrUseCase(makeRepo(null), makeStorage(), makeShareRepo()).execute({ id: 'x', userId: 'u' })
    ).rejects.toThrow(NotFoundException);
  });

  // Test 18 — TPP: conditional
  it('should throw NotFoundException when deleteById returns false (race)', async () => {
    await expect(
      new DeleteQrUseCase(makeRepo(urlQr, false), makeStorage(), makeShareRepo()).execute({ id: 'qr-1', userId: 'user-1' })
    ).rejects.toThrow(NotFoundException);
  });
});
