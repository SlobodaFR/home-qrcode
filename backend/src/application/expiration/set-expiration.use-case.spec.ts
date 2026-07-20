import { NotFoundException } from '@nestjs/common';
import { QrCode } from '../../domain/qr/qr-code';
import { QrRepository } from '../../domain/qr/qr.repository';
import { SetExpirationUseCase } from './set-expiration.use-case';

const makeRepo = (qr: QrCode | null = null): jest.Mocked<QrRepository> => ({
  findById: jest.fn(),
  findByIdAndUserId: jest.fn().mockResolvedValue(qr),
  findAllByUserId: jest.fn(),
  findAllLinksByUserId: jest.fn(),
  save: jest.fn().mockResolvedValue(undefined),
  deleteById: jest.fn(),
  incrementScanCount: jest.fn(),
});

const makeQr = (expiresAt: Date | null = null) => QrCode.create({
  id: 'qr-1', userId: 'u1', contentType: 'url', content: 'https://example.com',
  size: 1024, fgColor: '#000', bgColor: '#FFF', errorCorrection: 'M',
  createdAt: new Date(), expiresAt,
});

describe('SetExpirationUseCase', () => {
  // link-expiration: Test 11 — TPP: constant
  it('should call repository.save with entity updated via withExpiration', async () => {
    const qr = makeQr(null);
    const repo = makeRepo(qr);
    const uc = new SetExpirationUseCase(repo);
    const expiry = new Date('2026-08-25T23:59:59.000Z');
    await uc.execute({ id: 'qr-1', userId: 'u1', expiresAt: expiry });
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ expiresAt: expiry }));
  });

  // link-expiration: Test 12 — TPP: variable
  it('should return entity with the new expiresAt value', async () => {
    const qr = makeQr(null);
    const repo = makeRepo(qr);
    const uc = new SetExpirationUseCase(repo);
    const expiry = new Date('2026-08-25T23:59:59.000Z');
    const result = await uc.execute({ id: 'qr-1', userId: 'u1', expiresAt: expiry });
    expect(result.entity.expiresAt).toEqual(expiry);
  });

  // link-expiration: Test 13 — TPP: conditional
  it('should throw NotFoundException when record not found or not owned', async () => {
    const repo = makeRepo(null);
    const uc = new SetExpirationUseCase(repo);
    await expect(uc.execute({ id: 'missing', userId: 'u1', expiresAt: null }))
      .rejects.toThrow(NotFoundException);
  });

  // link-expiration: Test 14 — TPP: variable
  it('should call save with expiresAt=null when command expiresAt is null', async () => {
    const expiry = new Date('2026-08-25T23:59:59.000Z');
    const qr = makeQr(expiry);
    const repo = makeRepo(qr);
    const uc = new SetExpirationUseCase(repo);
    await uc.execute({ id: 'qr-1', userId: 'u1', expiresAt: null });
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ expiresAt: null }));
  });
});
