import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { QrRepository } from '../../domain/qr/qr.repository';
import { QrShare } from '../../domain/qr/qr-share';
import { QrShareRepository } from '../../domain/qr/qr-share.repository';
import { UserRepository } from '../../domain/user/user.repository';
import { randomUUID } from 'crypto';

export interface ShareQrCommand {
  qrId: string;
  ownerId: string;
  recipientId: string;
}

export interface ShareQrResult {
  share: QrShare;
}

@Injectable()
export class ShareQrUseCase {
  constructor(
    private readonly qrRepository: QrRepository,
    private readonly qrShareRepository: QrShareRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(cmd: ShareQrCommand): Promise<ShareQrResult> {
    const qr = await this.qrRepository.findById(cmd.qrId);
    if (!qr) throw new NotFoundException();

    if (qr.userId !== cmd.ownerId) throw new ForbiddenException();

    if (cmd.ownerId === cmd.recipientId) throw new BadRequestException('Cannot share with yourself');

    const recipient = await this.userRepository.findById(cmd.recipientId);
    if (!recipient) throw new NotFoundException('Recipient not found');

    const existing = await this.qrShareRepository.findByQrAndRecipient(cmd.qrId, cmd.recipientId);
    if (existing) throw new ConflictException('Already shared with this user');

    const share = QrShare.create({
      id: randomUUID(),
      qrId: cmd.qrId,
      ownerId: cmd.ownerId,
      recipientId: cmd.recipientId,
      createdAt: new Date(),
    });
    await this.qrShareRepository.save(share);
    return { share };
  }
}
