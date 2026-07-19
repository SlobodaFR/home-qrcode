import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';

@Injectable()
export class MinioClientService implements OnModuleInit {
  readonly client: Client;
  readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.getOrThrow<string>('MINIO_ENDPOINT');
    const url = new URL(endpoint.startsWith('http') ? endpoint : `https://${endpoint}`);
    this.bucket = this.config.getOrThrow<string>('MINIO_BUCKET');
    this.client = new Client({
      endPoint: url.hostname,
      port: url.port ? parseInt(url.port) : undefined,
      useSSL: url.protocol === 'https:',
      accessKey: this.config.getOrThrow<string>('MINIO_ACCESS_KEY_ID'),
      secretKey: this.config.getOrThrow<string>('MINIO_SECRET_ACCESS_KEY'),
      region: this.config.get<string>('MINIO_REGION', 'us-east-1'),
    });
  }

  async onModuleInit(): Promise<void> {
    if (this.config.get<string>('NODE_ENV') !== 'production') return;
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      throw new Error(`MinIO bucket "${this.bucket}" not found — check MINIO_* env vars`);
    }
  }
}
