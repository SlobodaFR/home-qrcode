import { Injectable, Logger } from '@nestjs/common';
import { MinioClientService } from '../minio/minio-client.service';
import { QrStoragePort } from '../../domain/qr/qr-storage.port';

@Injectable()
export class MinioQrStorage extends QrStoragePort {
  private readonly logger = new Logger(MinioQrStorage.name);

  constructor(private readonly minio: MinioClientService) {
    super();
  }

  async uploadPng(id: string, buffer: Buffer): Promise<void> {
    await this.minio.client.putObject(
      this.minio.bucket, `qr/${id}/qr.png`, buffer, buffer.length,
      { 'Content-Type': 'image/png' },
    );
  }

  async uploadSvg(id: string, content: string): Promise<void> {
    const buffer = Buffer.from(content);
    await this.minio.client.putObject(
      this.minio.bucket, `qr/${id}/qr.svg`, buffer, buffer.length,
      { 'Content-Type': 'image/svg+xml' },
    );
  }

  async streamPng(id: string): Promise<NodeJS.ReadableStream> {
    return this.minio.client.getObject(this.minio.bucket, `qr/${id}/qr.png`);
  }

  async streamSvg(id: string): Promise<NodeJS.ReadableStream> {
    return this.minio.client.getObject(this.minio.bucket, `qr/${id}/qr.svg`);
  }

  async exists(id: string): Promise<boolean> {
    try {
      await this.minio.client.statObject(this.minio.bucket, `qr/${id}/qr.png`);
      return true;
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'NotFound' || code === 'NoSuchKey') return false;
      throw err;
    }
  }

  async delete(id: string): Promise<void> {
    const results = await Promise.allSettled([
      this.minio.client.removeObject(this.minio.bucket, `qr/${id}/qr.png`),
      this.minio.client.removeObject(this.minio.bucket, `qr/${id}/qr.svg`),
    ]);
    for (const r of results) {
      if (r.status === 'rejected') this.logger.warn(`MinIO delete failed for qr/${id}: ${String(r.reason)}`);
    }
  }
}
