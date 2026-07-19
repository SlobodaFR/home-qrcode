import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { MinioClientService } from '../minio/minio-client.service';
import { MinioQrStorage } from './minio-qr-storage';

const ASSETS_PATH = 'qrcode-assets/prod';

const makeConfig = (): ConfigService =>
  ({ getOrThrow: () => ASSETS_PATH }) as unknown as ConfigService;

const makeMinioService = (overrides: Partial<Record<string, jest.Mock>> = {}): MinioClientService => {
  const client = {
    putObject: jest.fn().mockResolvedValue(undefined),
    getObject: jest.fn().mockResolvedValue({ pipe: jest.fn() }),
    statObject: jest.fn().mockResolvedValue({}),
    removeObject: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return { client: client as unknown as Client, bucket: 'test-bucket' } as MinioClientService;
};

const makeStorage = (overrides: Partial<Record<string, jest.Mock>> = {}) =>
  new MinioQrStorage(makeMinioService(overrides), makeConfig());

describe('MinioQrStorage', () => {
  // Test 12 — TPP: constant
  it('should call putObject with MINIO_ASSETS_PATH key for uploadPng', async () => {
    const svc = makeMinioService();
    const storage = new MinioQrStorage(svc, makeConfig());
    const buf = Buffer.from('png-data');
    await storage.uploadPng('abc-123', buf);
    expect(svc.client.putObject).toHaveBeenCalledWith(
      'test-bucket', `${ASSETS_PATH}/abc-123/qr.png`, buf, buf.length,
      { 'Content-Type': 'image/png' },
    );
  });

  // Test 13 — TPP: variable
  it('should call putObject with MINIO_ASSETS_PATH key for uploadSvg', async () => {
    const svc = makeMinioService();
    const storage = new MinioQrStorage(svc, makeConfig());
    await storage.uploadSvg('abc-123', '<svg/>');
    const svgBuf = Buffer.from('<svg/>');
    expect(svc.client.putObject).toHaveBeenCalledWith(
      'test-bucket', `${ASSETS_PATH}/abc-123/qr.svg`, svgBuf, svgBuf.length,
      { 'Content-Type': 'image/svg+xml' },
    );
  });

  // Test 14 — TPP: constant
  it('should call getObject with MINIO_ASSETS_PATH key for streamPng', async () => {
    const svc = makeMinioService();
    const storage = new MinioQrStorage(svc, makeConfig());
    await storage.streamPng('abc-123');
    expect(svc.client.getObject).toHaveBeenCalledWith('test-bucket', `${ASSETS_PATH}/abc-123/qr.png`);
  });

  // Test 15 — TPP: variable
  it('should call getObject with MINIO_ASSETS_PATH key for streamSvg', async () => {
    const svc = makeMinioService();
    const storage = new MinioQrStorage(svc, makeConfig());
    await storage.streamSvg('abc-123');
    expect(svc.client.getObject).toHaveBeenCalledWith('test-bucket', `${ASSETS_PATH}/abc-123/qr.svg`);
  });

  // Test 16 — TPP: constant
  it('should return true from exists() when statObject succeeds', async () => {
    const svc = makeMinioService();
    const storage = new MinioQrStorage(svc, makeConfig());
    expect(await storage.exists('abc-123')).toBe(true);
    expect(svc.client.statObject).toHaveBeenCalledWith('test-bucket', `${ASSETS_PATH}/abc-123/qr.png`);
  });

  // Test 17 — TPP: conditional
  it('should return false from exists() when statObject throws a NotFound-like error', async () => {
    const notFoundErr = Object.assign(new Error('Not Found'), { code: 'NotFound' });
    const storage = makeStorage({ statObject: jest.fn().mockRejectedValue(notFoundErr) });
    expect(await storage.exists('abc-123')).toBe(false);
  });

  // Test 12 (history) — TPP: constant
  it('delete() should call removeObject for both keys under MINIO_ASSETS_PATH', async () => {
    const svc = makeMinioService();
    const storage = new MinioQrStorage(svc, makeConfig());
    await storage.delete('abc-123');
    expect(svc.client.removeObject).toHaveBeenCalledWith('test-bucket', `${ASSETS_PATH}/abc-123/qr.png`);
    expect(svc.client.removeObject).toHaveBeenCalledWith('test-bucket', `${ASSETS_PATH}/abc-123/qr.svg`);
  });

  // Test 13 (history) — TPP: conditional
  it('delete() should not throw when one removal fails', async () => {
    const storage = makeStorage({ removeObject: jest.fn().mockRejectedValueOnce(new Error('gone')).mockResolvedValue(undefined) });
    await expect(storage.delete('abc-123')).resolves.toBeUndefined();
  });

  // Test 14 (history) — TPP: conditional
  it('delete() should not throw when both removals fail', async () => {
    const storage = makeStorage({ removeObject: jest.fn().mockRejectedValue(new Error('gone')) });
    await expect(storage.delete('abc-123')).resolves.toBeUndefined();
  });
});
