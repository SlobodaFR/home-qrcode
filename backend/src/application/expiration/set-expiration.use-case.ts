import { Injectable, NotFoundException } from '@nestjs/common';
import { QrCode } from '../../domain/qr/qr-code';
import { QrRepository } from '../../domain/qr/qr.repository';

export interface SetExpirationCommand {
  id: string;
  userId: string;
  expiresAt: Date | null;
}

export interface SetExpirationResult {
  entity: QrCode;
}

@Injectable()
export class SetExpirationUseCase {
  constructor(private readonly repository: QrRepository) {}

  async execute(cmd: SetExpirationCommand): Promise<SetExpirationResult> {
    const qr = await this.repository.findByIdAndUserId(cmd.id, cmd.userId);
    if (!qr) throw new NotFoundException();
    const updated = qr.withExpiration(cmd.expiresAt);
    await this.repository.save(updated);
    return { entity: updated };
  }
}
