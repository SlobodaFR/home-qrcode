import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { QrCode } from '../../domain/qr/qr-code';
import { QrRepository } from '../../domain/qr/qr.repository';

export interface EditTargetUrlCommand {
  id: string;
  userId: string;
  content: string;
}

export interface EditTargetUrlResult {
  qr: QrCode;
}

@Injectable()
export class EditTargetUrlUseCase {
  constructor(private readonly repository: QrRepository) {}

  async execute(cmd: EditTargetUrlCommand): Promise<EditTargetUrlResult> {
    const qr = await this.repository.findByIdAndUserId(cmd.id, cmd.userId);
    if (!qr) throw new NotFoundException();
    if (qr.contentType !== 'url') throw new UnprocessableEntityException();
    const updated = qr.withContent(cmd.content);
    await this.repository.save(updated);
    return { qr: updated };
  }
}
