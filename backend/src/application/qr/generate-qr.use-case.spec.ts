import { QrCode } from '../../domain/qr/qr-code';
import { QrImageGenerator, QrOptions } from '../../domain/qr/qr-image-generator';
import { QrRepository } from '../../domain/qr/qr.repository';
import { QrStoragePort } from '../../domain/qr/qr-storage.port';
import { GenerateQrCommand, GenerateQrUseCase } from './generate-qr.use-case';
import { encodeEmail, encodeVcard, encodeWifi } from './qr-content.encoder';

const mockPng = Buffer.from('png');
const mockSvg = '<svg/>';

const makeGenerator = (): jest.Mocked<QrImageGenerator> =>
  ({ generate: jest.fn().mockResolvedValue({ png: mockPng, svg: mockSvg }) });

const makeStorage = (): jest.Mocked<QrStoragePort> =>
  ({
    uploadPng: jest.fn().mockResolvedValue(undefined),
    uploadSvg: jest.fn().mockResolvedValue(undefined),
    uploadLogo: jest.fn().mockResolvedValue(undefined),
    streamPng: jest.fn(),
    streamSvg: jest.fn(),
    streamLogo: jest.fn(),
    exists: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
  });

const makeRepo = (): jest.Mocked<QrRepository> =>
  ({ findById: jest.fn(), findByIdAndUserId: jest.fn(), findAllByUserId: jest.fn(), save: jest.fn().mockResolvedValue(undefined), deleteById: jest.fn(), incrementScanCount: jest.fn().mockResolvedValue(undefined) });

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

  // Test 33 — TPP: conditional
  it('should call encodeWifi and store ssid as content when contentType is wifi', async () => {
    const generator = makeGenerator();
    const repo = makeRepo();
    const wifiCmd: GenerateQrCommand = {
      userId: 'user-1', contentType: 'wifi',
      wifi: { ssid: 'HomeNet', security: 'WPA', password: 'pass123' },
      size: 1024, fgColor: '#000000', bgColor: '#FFFFFF', errorCorrection: 'M',
      frontendUrl: 'https://qrcode.example.com',
    };
    const uc = new GenerateQrUseCase(generator, makeStorage(), repo);
    const result = await uc.execute(wifiCmd);
    const expectedEncoded = encodeWifi({ ssid: 'HomeNet', security: 'WPA', password: 'pass123' });
    expect(generator.generate).toHaveBeenCalledWith(expectedEncoded, expect.any(Object));
    expect(result.qr.content).toBe('HomeNet');
    expect(result.qr.contentType).toBe('wifi');
  });

  // Test 34 — TPP: conditional
  it('should call encodeEmail and store to as content when contentType is email', async () => {
    const generator = makeGenerator();
    const repo = makeRepo();
    const emailCmd: GenerateQrCommand = {
      userId: 'user-1', contentType: 'email',
      emailFields: { to: 'user@example.com', subject: 'Hello' },
      size: 1024, fgColor: '#000000', bgColor: '#FFFFFF', errorCorrection: 'M',
      frontendUrl: 'https://qrcode.example.com',
    };
    const uc = new GenerateQrUseCase(generator, makeStorage(), repo);
    const result = await uc.execute(emailCmd);
    const expectedEncoded = encodeEmail({ to: 'user@example.com', subject: 'Hello' });
    expect(generator.generate).toHaveBeenCalledWith(expectedEncoded, expect.any(Object));
    expect(result.qr.content).toBe('user@example.com');
    expect(result.qr.contentType).toBe('email');
  });

  // Test 35 — TPP: conditional
  it('should call encodeVcard and store name as content when contentType is vcard', async () => {
    const generator = makeGenerator();
    const repo = makeRepo();
    const vcardCmd: GenerateQrCommand = {
      userId: 'user-1', contentType: 'vcard',
      vcard: { name: 'Jane Doe', phone: '+33612345678' },
      size: 1024, fgColor: '#000000', bgColor: '#FFFFFF', errorCorrection: 'M',
      frontendUrl: 'https://qrcode.example.com',
    };
    const uc = new GenerateQrUseCase(generator, makeStorage(), repo);
    const result = await uc.execute(vcardCmd);
    const expectedEncoded = encodeVcard({ name: 'Jane Doe', phone: '+33612345678' });
    expect(generator.generate).toHaveBeenCalledWith(expectedEncoded, expect.any(Object));
    expect(result.qr.content).toBe('Jane Doe');
    expect(result.qr.contentType).toBe('vcard');
  });

  // Logo-overlay: Test 7 — TPP: variable
  it('URL type: saved qr.encodedContent should equal {frontendUrl}/r/{id}', async () => {
    const uc = new GenerateQrUseCase(makeGenerator(), makeStorage(), makeRepo());
    const result = await uc.execute({ ...baseCmd, contentType: 'url', content: 'https://target.com' });
    expect(result.qr.encodedContent).toMatch(/^https:\/\/qrcode\.example\.com\/r\/.+$/);
  });

  // Logo-overlay: Test 8 — TPP: variable
  it('Wifi type: saved qr.encodedContent should equal the encoded wifi string', async () => {
    const uc = new GenerateQrUseCase(makeGenerator(), makeStorage(), makeRepo());
    const result = await uc.execute({
      ...baseCmd, contentType: 'wifi',
      wifi: { ssid: 'HomeNet', security: 'WPA', password: 'pass123' },
    });
    expect(result.qr.encodedContent).toBe('WIFI:T:WPA;S:HomeNet;P:pass123;;');
  });

  // Logo-overlay: Test 9 — TPP: constant
  it('Any type: saved qr.hasLogo should be false', async () => {
    const uc = new GenerateQrUseCase(makeGenerator(), makeStorage(), makeRepo());
    const result = await uc.execute(baseCmd);
    expect(result.qr.hasLogo).toBe(false);
  });
});
