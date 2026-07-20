import { Injectable, NotFoundException } from '@nestjs/common';
import { QrCode } from '../../domain/qr/qr-code';
import { QrRepository } from '../../domain/qr/qr.repository';

export interface EditLinkCommand {
  id: string;
  userId: string;
  url: string;
}

export interface EditLinkResult {
  link: QrCode;
}

@Injectable()
export class EditLinkUseCase {
  constructor(private readonly repository: QrRepository) {}

  async execute(cmd: EditLinkCommand): Promise<EditLinkResult> {
    const qr = await this.repository.findByIdAndUserId(cmd.id, cmd.userId);
    if (!qr) throw new NotFoundException();
    if (qr.source !== 'shortlink') throw new NotFoundException();
    const updated = qr.withContent(cmd.url);
    await this.repository.save(updated);
    return { link: updated };
  }
}
