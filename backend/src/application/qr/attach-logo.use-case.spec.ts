import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { QrCode } from '../../domain/qr/qr-code';
import { QrImageGenerator } from '../../domain/qr/qr-image-generator';
import { QrRepository } from '../../domain/qr/qr.repository';
import { QrStoragePort } from '../../domain/qr/qr-storage.port';
import { LogoCompositorPort } from '../../domain/qr/logo-compositor.port';
import { AttachLogoCommand, AttachLogoUseCase } from './attach-logo.use-case';

const mockPng = Buffer.from('png-data');
const mockSvg = '<svg/>';
const logoBuffer = Buffer.from('logo-data');

function makeQr(overrides: Partial<Parameters<typeof QrCode.create>[0]> = {}): QrCode {
  return QrCode.create({
    id: 'qr-1',
    userId: 'user-1',
    contentType: 'url',
    content: 'https://target.com',
    encodedContent: 'https://qrcode.example.com/r/qr-1',
    size: 200,
    fgColor: '#000000',
    bgColor: '#FFFFFF',
    errorCorrection: 'M',
    hasLogo: false,
    createdAt: new Date(),
    ...overrides,
  });
}

const makeGenerator = (): jest.Mocked<QrImageGenerator> =>
  ({ generate: jest.fn().mockResolvedValue({ png: mockPng, svg: mockSvg }) });

const makeStorage = (): jest.Mocked<QrStoragePort> => (({
  uploadPng: jest.fn().mockResolvedValue(undefined),
  uploadSvg: jest.fn().mockResolvedValue(undefined),
  uploadLogo: jest.fn().mockResolvedValue(undefined),
  streamPng: jest.fn(),
  streamSvg: jest.fn(),
  streamLogo: jest.fn(),
  exists: jest.fn(),
  delete: jest.fn().mockResolvedValue(undefined),
}));

const makeRepo = (): jest.Mocked<QrRepository> => (({
  findById: jest.fn(),
  findByIdAndUserId: jest.fn(),
  findAllByUserId: jest.fn(),
  save: jest.fn().mockResolvedValue(undefined),
  deleteById: jest.fn(),
  incrementScanCount: jest.fn(),
}));

const makeCompositor = (): jest.Mocked<LogoCompositorPort> =>
  ({ composite: jest.fn().mockResolvedValue(Buffer.from('composited-png')) });

const baseCmd: AttachLogoCommand = {
  id: 'qr-1',
  userId: 'user-1',
  logoBuffer,
  logoMimeType: 'image/png',
  frontendUrl: 'https://qrcode.example.com',
};

describe('AttachLogoUseCase', () => {
  // Test 10 — TPP: constant
  it('should throw NotFoundException when QR not found', async () => {
    const repo = makeRepo();
    repo.findByIdAndUserId.mockResolvedValue(null);
    const uc = new AttachLogoUseCase(makeGenerator(), makeStorage(), repo, makeCompositor());
    await expect(uc.execute(baseCmd)).rejects.toThrow(NotFoundException);
  });

  // Test 11 — TPP: conditional
  it('should throw ConflictException when qr.hasLogo is true', async () => {
    const repo = makeRepo();
    repo.findByIdAndUserId.mockResolvedValue(makeQr({ hasLogo: true }));
    const uc = new AttachLogoUseCase(makeGenerator(), makeStorage(), repo, makeCompositor());
    await expect(uc.execute(baseCmd)).rejects.toThrow(ConflictException);
  });

  // Test 12 — TPP: conditional
  it('URL type with encodedContent null should reconstruct as {frontendUrl}/r/{id}', async () => {
    const repo = makeRepo();
    repo.findByIdAndUserId.mockResolvedValue(makeQr({ encodedContent: null }));
    const generator = makeGenerator();
    const uc = new AttachLogoUseCase(generator, makeStorage(), repo, makeCompositor());
    await uc.execute(baseCmd);
    expect(generator.generate).toHaveBeenCalledWith(
      'https://qrcode.example.com/r/qr-1',
      expect.any(Object),
    );
  });

  // Test 13 — TPP: conditional
  it('Text type with encodedContent null should use qr.content directly', async () => {
    const repo = makeRepo();
    repo.findByIdAndUserId.mockResolvedValue(
      makeQr({ contentType: 'text', content: 'Hello world', encodedContent: null }),
    );
    const generator = makeGenerator();
    const uc = new AttachLogoUseCase(generator, makeStorage(), repo, makeCompositor());
    await uc.execute(baseCmd);
    expect(generator.generate).toHaveBeenCalledWith('Hello world', expect.any(Object));
  });

  // Test 14 — TPP: conditional
  it('Wifi type with encodedContent null should throw UnprocessableEntityException', async () => {
    const repo = makeRepo();
    repo.findByIdAndUserId.mockResolvedValue(
      makeQr({ contentType: 'wifi', content: 'HomeNet', encodedContent: null }),
    );
    const uc = new AttachLogoUseCase(makeGenerator(), makeStorage(), repo, makeCompositor());
    await expect(uc.execute(baseCmd)).rejects.toThrow(UnprocessableEntityException);
  });

  // Test 15 — TPP: conditional
  it('Should use stored encodedContent (non-null) directly without reconstruction', async () => {
    const repo = makeRepo();
    repo.findByIdAndUserId.mockResolvedValue(
      makeQr({ encodedContent: 'WIFI:T:WPA;S:HomeNet;P:pass;;', contentType: 'wifi', content: 'HomeNet' }),
    );
    const generator = makeGenerator();
    const uc = new AttachLogoUseCase(generator, makeStorage(), repo, makeCompositor());
    await uc.execute(baseCmd);
    expect(generator.generate).toHaveBeenCalledWith('WIFI:T:WPA;S:HomeNet;P:pass;;', expect.any(Object));
  });

  // Test 16 — TPP: conditional
  it('L correction level should be upgraded to Q when calling generator.generate()', async () => {
    const repo = makeRepo();
    repo.findByIdAndUserId.mockResolvedValue(makeQr({ errorCorrection: 'L' }));
    const generator = makeGenerator();
    const uc = new AttachLogoUseCase(generator, makeStorage(), repo, makeCompositor());
    await uc.execute(baseCmd);
    expect(generator.generate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ errorCorrection: 'Q' }),
    );
  });

  // Test 17 — TPP: conditional
  it('H correction level should be passed to generator.generate() unchanged', async () => {
    const repo = makeRepo();
    repo.findByIdAndUserId.mockResolvedValue(makeQr({ errorCorrection: 'H' }));
    const generator = makeGenerator();
    const uc = new AttachLogoUseCase(generator, makeStorage(), repo, makeCompositor());
    await uc.execute(baseCmd);
    expect(generator.generate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ errorCorrection: 'H' }),
    );
  });

  // Test 18 — TPP: variable
  it('Should call compositor.composite() with PNG from generator and logoBuffer', async () => {
    const repo = makeRepo();
    repo.findByIdAndUserId.mockResolvedValue(makeQr());
    const compositor = makeCompositor();
    const uc = new AttachLogoUseCase(makeGenerator(), makeStorage(), repo, compositor);
    await uc.execute(baseCmd);
    expect(compositor.composite).toHaveBeenCalledWith(mockPng, logoBuffer);
  });

  // Test 19 — TPP: variable
  it('On success: uploads logo, overwrites PNG, saves QR with hasLogo true, returns updated QR', async () => {
    const repo = makeRepo();
    repo.findByIdAndUserId.mockResolvedValue(makeQr());
    const storage = makeStorage();
    const compositedPng = Buffer.from('composited');
    const compositor = makeCompositor();
    (compositor.composite as jest.Mock).mockResolvedValue(compositedPng);
    const uc = new AttachLogoUseCase(makeGenerator(), storage, repo, compositor);
    const result = await uc.execute(baseCmd);
    expect(storage.uploadLogo).toHaveBeenCalledWith('qr-1', logoBuffer, 'image/png');
    expect(storage.uploadPng).toHaveBeenCalledWith('qr-1', compositedPng);
    expect(repo.save).toHaveBeenCalled();
    expect(result.qr.hasLogo).toBe(true);
    expect(result.qr.logoMimeType).toBe('image/png');
  });
});
