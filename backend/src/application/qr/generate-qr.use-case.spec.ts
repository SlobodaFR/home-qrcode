import { QrCode } from '../../domain/qr/qr-code';
import { QrImageGenerator, QrOptions } from '../../domain/qr/qr-image-generator';
import { QrRepository } from '../../domain/qr/qr.repository';
import { QrStoragePort } from '../../domain/qr/qr-storage.port';
import { GenerateQrCommand, GenerateQrUseCase } from './generate-qr.use-case';

const mockPng = Buffer.from('png');
const mockSvg = '<svg/>';

const makeGenerator = (): jest.Mocked<QrImageGenerator> =>
  ({ generate: jest.fn().mockResolvedValue({ png: mockPng, svg: mockSvg }) });

const makeStorage = (): jest.Mocked<QrStoragePort> =>
  ({
    uploadPng: jest.fn().mockResolvedValue(undefined),
    uploadSvg: jest.fn().mockResolvedValue(undefined),
    streamPng: jest.fn(),
    streamSvg: jest.fn(),
    exists: jest.fn(),
  });

const makeRepo = (): jest.Mocked<QrRepository> =>
  ({ findById: jest.fn(), findByIdAndUserId: jest.fn(), save: jest.fn().mockResolvedValue(undefined), incrementScanCount: jest.fn().mockResolvedValue(undefined) });

const baseCmd: GenerateQrCommand = {
  userId: 'user-1',
  contentType: 'text',
  content: 'Hello world',
  size: 1024,
  fgColor: '#000000',
  bgColor: '#FFFFFF',
  errorCorrection: 'M',
  frontendUrl: 'https://qrcode.example.com',
};

describe('GenerateQrUseCase', () => {
  // Test 3 — TPP: constant
  it('should call generator with content directly for contentType "text"', async () => {
    const generator = makeGenerator();
    const uc = new GenerateQrUseCase(generator, makeStorage(), makeRepo());
    await uc.execute(baseCmd);
    const opts: QrOptions = { size: 1024, fgColor: '#000000', bgColor: '#FFFFFF', errorCorrection: 'M' };
    expect(generator.generate).toHaveBeenCalledWith('Hello world', opts);
  });

  // Test 4 — TPP: conditional
  it('should call generator with {frontendUrl}/r/{id} for contentType "url", not target URL', async () => {
    const generator = makeGenerator();
    const uc = new GenerateQrUseCase(generator, makeStorage(), makeRepo());
    const result = await uc.execute({ ...baseCmd, contentType: 'url', content: 'https://target.com' });
    const callArg = ((generator.generate as jest.Mock).mock.calls[0] as unknown[])[0] as string;
    expect(callArg).toMatch(/^https:\/\/qrcode\.example\.com\/r\/.+$/);
    expect(callArg).not.toContain('target.com');
    expect(result.qr.content).toBe('https://target.com');
  });

  // Test 5 — TPP: variable
  it('should call storage.uploadPng and storage.uploadSvg with the generated buffers', async () => {
    const storage = makeStorage();
    const uc = new GenerateQrUseCase(makeGenerator(), storage, makeRepo());
    const result = await uc.execute(baseCmd);
    expect(storage.uploadPng).toHaveBeenCalledWith(result.qr.id, mockPng);
    expect(storage.uploadSvg).toHaveBeenCalledWith(result.qr.id, mockSvg);
  });

  // Test 6 — TPP: variable
  it('should call repository.save with a QrCode containing correct props', async () => {
    const repo = makeRepo();
    const uc = new GenerateQrUseCase(makeGenerator(), makeStorage(), repo);
    const result = await uc.execute(baseCmd);
    expect(repo.save).toHaveBeenCalledWith(result.qr);
    expect(result.qr.userId).toBe('user-1');
    expect(result.qr.contentType).toBe('text');
    expect(result.qr.content).toBe('Hello world');
  });

  // Test 7 — TPP: constant
  it('should return the saved QrCode', async () => {
    const uc = new GenerateQrUseCase(makeGenerator(), makeStorage(), makeRepo());
    const result = await uc.execute(baseCmd);
    expect(result.qr).toBeInstanceOf(QrCode);
    expect(result.qr.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  // Test 8 — TPP: conditional
  it('should propagate error and not call repository.save if uploadPng throws', async () => {
    const storage = makeStorage();
    (storage.uploadPng as jest.Mock).mockRejectedValue(new Error('minio error'));
    const repo = makeRepo();
    const uc = new GenerateQrUseCase(makeGenerator(), storage, repo);
    await expect(uc.execute(baseCmd)).rejects.toThrow('minio error');
    expect(repo.save).not.toHaveBeenCalled();
  });

  // Test 9 — TPP: conditional
  it('should propagate error and not call repository.save if uploadSvg throws', async () => {
    const storage = makeStorage();
    (storage.uploadSvg as jest.Mock).mockRejectedValue(new Error('svg upload error'));
    const repo = makeRepo();
    const uc = new GenerateQrUseCase(makeGenerator(), storage, repo);
    await expect(uc.execute(baseCmd)).rejects.toThrow('svg upload error');
    expect(repo.save).not.toHaveBeenCalled();
  });
});
