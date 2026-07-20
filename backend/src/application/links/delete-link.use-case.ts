import { Injectable, NotFoundException } from '@nestjs/common';
import { QrRepository } from '../../domain/qr/qr.repository';

export interface DeleteLinkCommand {
  id: string;
  userId: string;
}

@Injectable()
export class DeleteLinkUseCase {
  constructor(private readonly repository: QrRepository) {}

  async execute(cmd: DeleteLinkCommand): Promise<void> {
    const qr = await this.repository.findByIdAndUserId(cmd.id, cmd.userId);
    if (!qr) throw new NotFoundException();
    if (qr.source !== 'shortlink') throw new NotFoundException();
    await this.repository.deleteById(cmd.id, cmd.userId);
  }
}
