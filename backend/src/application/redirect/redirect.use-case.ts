import { Injectable, NotFoundException } from '@nestjs/common';
import { QrRepository } from '../../domain/qr/qr.repository';

export interface RedirectCommand {
  id: string;
}

export interface RedirectResult {
  targetUrl: string;
}

@Injectable()
export class RedirectUseCase {
  constructor(private readonly repository: QrRepository) {}

  async execute(cmd: RedirectCommand): Promise<RedirectResult> {
    const qr = await this.repository.findById(cmd.id);
    if (!qr) throw new NotFoundException();
    if (qr.contentType !== 'url') throw new NotFoundException();
    void this.repository.incrementScanCount(cmd.id);
    return { targetUrl: qr.content };
  }
}
