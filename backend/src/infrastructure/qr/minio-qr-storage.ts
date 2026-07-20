import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QrStoragePort } from '../../domain/qr/qr-storage.port';
import { MinioClientService } from '../minio/minio-client.service';

@Injectable()
export class MinioQrStorage extends QrStoragePort {
  private readonly logger = new Logger(MinioQrStorage.name);
  private readonly assetsPath: string;

  constructor(private readonly minio: MinioClientService, config: ConfigService) {
    super();
    this.assetsPath = config.getOrThrow<string>('MINIO_ASSETS_PATH');
  }

  private key(id: string, ext: 'png' | 'svg'): string {
    return `${this.assetsPath}/${id}/qr.${ext}`;
  }

  private logoKey(id: string): string {
    return `${this.assetsPath}/${id}/logo`;
  }

  async uploadPng(id: string, buffer: Buffer): Promise<void> {
    await this.minio.client.putObject(
      this.minio.bucket, this.key(id, 'png'), buffer, buffer.length,
      { 'Content-Type': 'image/png' },
    );
  }

  async uploadSvg(id: string, content: string): Promise<void> {
    const buffer = Buffer.from(content);
    await this.minio.client.putObject(
      this.minio.bucket, this.key(id, 'svg'), buffer, buffer.length,
      { 'Content-Type': 'image/svg+xml' },
    );
  }

  async uploadLogo(id: string, buffer: Buffer, mimeType: string): Promise<void> {
    await this.minio.client.putObject(
      this.minio.bucket, this.logoKey(id), buffer, buffer.length,
      { 'Content-Type': mimeType },
    );
  }

  async streamPng(id: string): Promise<NodeJS.ReadableStream> {
    return this.minio.client.getObject(this.minio.bucket, this.key(id, 'png'));
  }

  async streamSvg(id: string): Promise<NodeJS.ReadableStream> {
    return this.minio.client.getObject(this.minio.bucket, this.key(id, 'svg'));
  }

  async streamLogo(id: string): Promise<NodeJS.ReadableStream> {
    return this.minio.client.getObject(this.minio.bucket, this.logoKey(id));
  }

  async exists(id: string): Promise<boolean> {
    try {
      await this.minio.client.statObject(this.minio.bucket, this.key(id, 'png'));
      return true;
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'NotFound' || code === 'NoSuchKey') return false;
      throw err;
    }
  }

  async delete(id: string): Promise<void> {
    const results = await Promise.allSettled([
      this.minio.client.removeObject(this.minio.bucket, this.key(id, 'png')),
      this.minio.client.removeObject(this.minio.bucket, this.key(id, 'svg')),
      this.minio.client.removeObject(this.minio.bucket, this.logoKey(id)),
    ]);
    for (const r of results) {
      if (r.status === 'rejected') this.logger.warn(`MinIO delete failed for ${this.key(id, 'png')}: ${String(r.reason)}`);
    }
  }
}
