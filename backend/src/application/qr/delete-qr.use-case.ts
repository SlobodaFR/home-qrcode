import { Injectable, NotFoundException } from '@nestjs/common';
import { QrRepository } from '../../domain/qr/qr.repository';
import { QrShareRepository } from '../../domain/qr/qr-share.repository';
import { QrStoragePort } from '../../domain/qr/qr-storage.port';

export interface DeleteQrCommand {
  id: string;
  userId: string;
}

@Injectable()
export class DeleteQrUseCase {
  constructor(
    private readonly repository: QrRepository,
    private readonly storage: QrStoragePort,
    private readonly qrShareRepository: QrShareRepository,
  ) {}

  async execute(cmd: DeleteQrCommand): Promise<void> {
    const qr = await this.repository.findByIdAndUserId(cmd.id, cmd.userId);
    if (!qr) throw new NotFoundException();
    await this.qrShareRepository.deleteByQrId(cmd.id);
    void this.storage.delete(cmd.id);
    const deleted = await this.repository.deleteById(cmd.id, cmd.userId);
    if (!deleted) throw new NotFoundException();
  }
}
