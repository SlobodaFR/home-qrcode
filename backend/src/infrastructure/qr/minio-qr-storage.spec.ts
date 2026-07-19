import { MinioQrStorage } from './minio-qr-storage';
import { MinioClientService } from '../minio/minio-client.service';
import { Client } from 'minio';

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

describe('MinioQrStorage', () => {
  // Test 12 — TPP: constant
  it('should call putObject with key qr/{id}/qr.png and content-type image/png on uploadPng', async () => {
    const svc = makeMinioService();
    const storage = new MinioQrStorage(svc);
    const buf = Buffer.from('png-data');
    await storage.uploadPng('abc-123', buf);
    expect(svc.client.putObject).toHaveBeenCalledWith(
      'test-bucket', 'qr/abc-123/qr.png', buf, buf.length,
      { 'Content-Type': 'image/png' },
    );
  });

  // Test 13 — TPP: variable
  it('should call putObject with key qr/{id}/qr.svg and content-type image/svg+xml on uploadSvg', async () => {
    const svc = makeMinioService();
    const storage = new MinioQrStorage(svc);
    await storage.uploadSvg('abc-123', '<svg/>');
    const svgBuf = Buffer.from('<svg/>');
    expect(svc.client.putObject).toHaveBeenCalledWith(
      'test-bucket', 'qr/abc-123/qr.svg', svgBuf, svgBuf.length,
      { 'Content-Type': 'image/svg+xml' },
    );
  });

  // Test 14 — TPP: constant
  it('should call getObject with key qr/{id}/qr.png on streamPng', async () => {
    const svc = makeMinioService();
    const storage = new MinioQrStorage(svc);
    await storage.streamPng('abc-123');
    expect(svc.client.getObject).toHaveBeenCalledWith('test-bucket', 'qr/abc-123/qr.png');
  });

  // Test 15 — TPP: variable
  it('should call getObject with key qr/{id}/qr.svg on streamSvg', async () => {
    const svc = makeMinioService();
    const storage = new MinioQrStorage(svc);
    await storage.streamSvg('abc-123');
    expect(svc.client.getObject).toHaveBeenCalledWith('test-bucket', 'qr/abc-123/qr.svg');
  });

  // Test 16 — TPP: constant
  it('should return true from exists() when statObject succeeds', async () => {
    const svc = makeMinioService();
    const storage = new MinioQrStorage(svc);
    expect(await storage.exists('abc-123')).toBe(true);
    expect(svc.client.statObject).toHaveBeenCalledWith('test-bucket', 'qr/abc-123/qr.png');
  });

  // Test 17 — TPP: conditional
  it('should return false from exists() when statObject throws a NotFound-like error', async () => {
    const notFoundErr = Object.assign(new Error('Not Found'), { code: 'NotFound' });
    const svc = makeMinioService({ statObject: jest.fn().mockRejectedValue(notFoundErr) });
    const storage = new MinioQrStorage(svc);
    expect(await storage.exists('abc-123')).toBe(false);
  });

  // Test 12 (history) — TPP: constant
  it('delete() should call removeObject for both qr.png and qr.svg keys', async () => {
    const svc = makeMinioService();
    const storage = new MinioQrStorage(svc);
    await storage.delete('abc-123');
    expect(svc.client.removeObject).toHaveBeenCalledWith('test-bucket', 'qr/abc-123/qr.png');
    expect(svc.client.removeObject).toHaveBeenCalledWith('test-bucket', 'qr/abc-123/qr.svg');
  });

  // Test 13 (history) — TPP: conditional
  it('delete() should not throw when one object removal fails', async () => {
    const svc = makeMinioService({ removeObject: jest.fn().mockRejectedValueOnce(new Error('gone')).mockResolvedValue(undefined) });
    const storage = new MinioQrStorage(svc);
    await expect(storage.delete('abc-123')).resolves.toBeUndefined();
  });

  // Test 14 (history) — TPP: conditional
  it('delete() should not throw when both removals fail', async () => {
    const svc = makeMinioService({ removeObject: jest.fn().mockRejectedValue(new Error('gone')) });
    const storage = new MinioQrStorage(svc);
    await expect(storage.delete('abc-123')).resolves.toBeUndefined();
  });
});
