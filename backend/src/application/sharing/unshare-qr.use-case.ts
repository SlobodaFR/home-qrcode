import { Injectable, NotFoundException } from '@nestjs/common';
import { QrShareRepository } from '../../domain/qr/qr-share.repository';

export interface UnshareQrCommand {
  shareId: string;
  qrId: string;
  ownerId: string;
}

@Injectable()
export class UnshareQrUseCase {
  constructor(private readonly qrShareRepository: QrShareRepository) {}

  async execute(cmd: UnshareQrCommand): Promise<void> {
    const share = await this.qrShareRepository.findById(cmd.shareId);
    if (!share) throw new NotFoundException();
    if (share.qrId !== cmd.qrId || share.ownerId !== cmd.ownerId) throw new NotFoundException();
    await this.qrShareRepository.deleteById(cmd.shareId);
  }
}
