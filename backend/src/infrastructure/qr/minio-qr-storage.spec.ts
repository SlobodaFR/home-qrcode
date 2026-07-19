import { MinioQrStorage } from './minio-qr-storage';
import { MinioClientService } from '../minio/minio-client.service';
import { Client } from 'minio';

const makeMinioService = (overrides: Partial<Record<string, jest.Mock>> = {}): MinioClientService => {
  const client = {
    putObject: jest.fn().mockResolvedValue(undefined),
    getObject: jest.fn().mockResolvedValue({ pipe: jest.fn() }),
    statObject: jest.fn().mockResolvedValue({}),
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
});
