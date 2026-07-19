import { Injectable } from '@nestjs/common';
import { QrCode } from '../../domain/qr/qr-code';
import { QrImageGenerator } from '../../domain/qr/qr-image-generator';
import { QrRepository } from '../../domain/qr/qr.repository';
import { QrStoragePort } from '../../domain/qr/qr-storage.port';

export interface GenerateQrCommand {
  userId: string;
  contentType: 'url' | 'text';
  content: string;
  size: number;
  fgColor: string;
  bgColor: string;
  errorCorrection: 'L' | 'M' | 'Q' | 'H';
  frontendUrl: string;
}

export interface GenerateQrResult {
  qr: QrCode;
}

@Injectable()
export class GenerateQrUseCase {
  constructor(
    private readonly generator: QrImageGenerator,
    private readonly storage: QrStoragePort,
    private readonly repository: QrRepository,
  ) {}

  async execute(cmd: GenerateQrCommand): Promise<GenerateQrResult> {
    const id = crypto.randomUUID();
    const encodedContent =
      cmd.contentType === 'url' ? `${cmd.frontendUrl}/r/${id}` : cmd.content;

    const { png, svg } = await this.generator.generate(encodedContent, {
      size: cmd.size,
      fgColor: cmd.fgColor,
      bgColor: cmd.bgColor,
      errorCorrection: cmd.errorCorrection,
    });

    await this.storage.uploadPng(id, png);
    await this.storage.uploadSvg(id, svg);

    const qr = QrCode.create({
      id,
      userId: cmd.userId,
      contentType: cmd.contentType,
      content: cmd.content,
      size: cmd.size,
      fgColor: cmd.fgColor,
      bgColor: cmd.bgColor,
      errorCorrection: cmd.errorCorrection,
      createdAt: new Date(),
    });

    await this.repository.save(qr);
    return { qr };
  }
}
