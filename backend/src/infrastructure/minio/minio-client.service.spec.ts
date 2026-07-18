import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { MinioClientService } from './minio-client.service';

const makeConfig = (nodeEnv: string) =>
  ({
    getOrThrow: jest.fn((key: string) =>
      ({
        MINIO_ENDPOINT: 'http://localhost:9000',
        MINIO_BUCKET: 'test-bucket',
        MINIO_ACCESS_KEY_ID: 'minioadmin',
        MINIO_SECRET_ACCESS_KEY: 'minioadmin',
      }[key] ?? ''),
    ),
    get: jest.fn((key: string, def?: string) => (key === 'NODE_ENV' ? nodeEnv : def)),
  }) as unknown as ConfigService;

describe('MinioClientService', () => {
  // Test 22 — TPP: constant
  it('should skip health check when NODE_ENV is not "production"', async () => {
    const svc = new MinioClientService(makeConfig('development'));
    svc.client.bucketExists = jest.fn() as jest.MockedFunction<Client['bucketExists']>;
    await svc.onModuleInit();
    expect(svc.client.bucketExists).not.toHaveBeenCalled();
  });

  // Test 23 — TPP: conditional
  it('should call bucketExists when NODE_ENV is "production"', async () => {
    const svc = new MinioClientService(makeConfig('production'));
    svc.client.bucketExists = jest.fn().mockResolvedValue(true) as jest.MockedFunction<Client['bucketExists']>;
    await svc.onModuleInit();
    expect(svc.client.bucketExists).toHaveBeenCalledWith('test-bucket');
  });

  // Test 24 — TPP: conditional
  it('should throw if bucket does not exist in production', async () => {
    const svc = new MinioClientService(makeConfig('production'));
    svc.client.bucketExists = jest.fn().mockResolvedValue(false) as jest.MockedFunction<Client['bucketExists']>;
    await expect(svc.onModuleInit()).rejects.toThrow('test-bucket');
  });
});
