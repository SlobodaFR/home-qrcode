import { Injectable } from '@nestjs/common';
import { QrCode } from '../../domain/qr/qr-code';
import { QrRepository } from '../../domain/qr/qr.repository';

export interface CreateLinkCommand {
  userId: string;
  url: string;
  expiresAt?: Date | null;
}

export interface CreateLinkResult {
  link: QrCode;
}

@Injectable()
export class CreateLinkUseCase {
  constructor(private readonly repository: QrRepository) {}

  async execute(cmd: CreateLinkCommand): Promise<CreateLinkResult> {
    const id = crypto.randomUUID();
    const link = QrCode.create({
      id,
      userId: cmd.userId,
      contentType: 'url',
      content: cmd.url,
      source: 'shortlink',
      expiresAt: cmd.expiresAt ?? null,
      size: 0,
      fgColor: '',
      bgColor: '',
      errorCorrection: 'M',
      createdAt: new Date(),
    });
    await this.repository.save(link);
    return { link };
  }
}
