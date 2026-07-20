import { NotFoundException } from '@nestjs/common';
import { QrCode } from '../../domain/qr/qr-code';
import { QrRepository } from '../../domain/qr/qr.repository';
import { EditLinkUseCase } from './edit-link.use-case';

const makeLink = (overrides: Partial<{ source: 'qr' | 'shortlink' | null }> = {}) =>
  QrCode.create({
    id: 'sl-1', userId: 'u1', contentType: 'url', content: 'https://old.com',
    source: overrides.source ?? 'shortlink',
    size: 0, fgColor: '', bgColor: '', errorCorrection: 'M', createdAt: new Date(),
  });

const makeRepo = (link: QrCode | null = makeLink()): jest.Mocked<QrRepository> => ({
  findById: jest.fn(),
  findByIdAndUserId: jest.fn().mockResolvedValue(link),
  findAllByUserId: jest.fn(),
  findAllLinksByUserId: jest.fn(),
  save: jest.fn().mockResolvedValue(undefined),
  deleteById: jest.fn(),
  incrementScanCount: jest.fn(),
});

describe('EditLinkUseCase', () => {
  // url-shortener: Test 11 — TPP: constant
  it('should return QrCode with updated content when link exists', async () => {
    const uc = new EditLinkUseCase(makeRepo());
    const { link } = await uc.execute({ id: 'sl-1', userId: 'u1', url: 'https://new.com' });
    expect(link.content).toBe('https://new.com');
    expect(link).toBeInstanceOf(QrCode);
  });

  // url-shortener: Test 12 — TPP: variable
  it('should call repository.save with the updated entity', async () => {
    const repo = makeRepo();
    const uc = new EditLinkUseCase(repo);
    await uc.execute({ id: 'sl-1', userId: 'u1', url: 'https://new.com' });
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ content: 'https://new.com' }));
  });

  // url-shortener: Test 13 — TPP: conditional
  it('should throw NotFoundException when id not found or not owned', async () => {
    const uc = new EditLinkUseCase(makeRepo(null));
    await expect(uc.execute({ id: 'missing', userId: 'u1', url: 'https://x.com' })).rejects.toThrow(NotFoundException);
  });

  // url-shortener: Test 14 — TPP: conditional
  it('should throw NotFoundException when source is not shortlink', async () => {
    const uc = new EditLinkUseCase(makeRepo(makeLink({ source: 'qr' })));
    await expect(uc.execute({ id: 'sl-1', userId: 'u1', url: 'https://x.com' })).rejects.toThrow(NotFoundException);
  });
});
