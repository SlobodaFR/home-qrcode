import { NotFoundException } from '@nestjs/common';
import { QrCode } from '../../domain/qr/qr-code';
import { QrRepository } from '../../domain/qr/qr.repository';
import { DeleteLinkUseCase } from './delete-link.use-case';

const makeLink = (source: 'qr' | 'shortlink' | null = 'shortlink') =>
  QrCode.create({
    id: 'sl-1', userId: 'u1', contentType: 'url', content: 'https://t.com',
    source, size: 0, fgColor: '', bgColor: '', errorCorrection: 'M', createdAt: new Date(),
  });

const makeRepo = (link: QrCode | null = makeLink()): jest.Mocked<QrRepository> => ({
  findById: jest.fn(),
  findByIdAndUserId: jest.fn().mockResolvedValue(link),
  findAllByUserId: jest.fn(),
  findAllLinksByUserId: jest.fn(),
  save: jest.fn(),
  deleteById: jest.fn().mockResolvedValue(true),
  incrementScanCount: jest.fn(),
});

describe('DeleteLinkUseCase', () => {
  // url-shortener: Test 15 — TPP: constant
  it('should call repository.deleteById when link exists and is a shortlink', async () => {
    const repo = makeRepo();
    const uc = new DeleteLinkUseCase(repo);
    await uc.execute({ id: 'sl-1', userId: 'u1' });
    expect(repo.deleteById).toHaveBeenCalledWith('sl-1', 'u1');
  });

  // url-shortener: Test 16 — TPP: conditional
  it('should throw NotFoundException when link not found or not owned', async () => {
    const uc = new DeleteLinkUseCase(makeRepo(null));
    await expect(uc.execute({ id: 'missing', userId: 'u1' })).rejects.toThrow(NotFoundException);
  });

  // url-shortener: Test 17 — TPP: conditional
  it('should throw NotFoundException when source is not shortlink', async () => {
    const uc = new DeleteLinkUseCase(makeRepo(makeLink('qr')));
    await expect(uc.execute({ id: 'sl-1', userId: 'u1' })).rejects.toThrow(NotFoundException);
  });

  // url-shortener: Test 18 — TPP: constant
  it('should only take QrRepository as constructor parameter (no storage dependency)', () => {
    const uc = new DeleteLinkUseCase(makeRepo());
    expect(uc).toBeInstanceOf(DeleteLinkUseCase);
    // If constructor required QrStoragePort this would not compile
  });
});
