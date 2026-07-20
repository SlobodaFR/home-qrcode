import { Injectable } from '@nestjs/common';
import { QrCode } from '../../domain/qr/qr-code';
import { QrShareRepository } from '../../domain/qr/qr-share.repository';
import { UserRepository } from '../../domain/user/user.repository';

export interface SharedWithMeItem {
  qrCode: QrCode;
  sharedBy: { id: string; name: string };
}

export interface ListSharedWithMeResult {
  items: SharedWithMeItem[];
}

@Injectable()
export class ListSharedWithMeUseCase {
  constructor(
    private readonly qrShareRepository: QrShareRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute({ userId }: { userId: string }): Promise<ListSharedWithMeResult> {
    const rows = await this.qrShareRepository.findWithQrByRecipientId(userId);
    if (rows.length === 0) return { items: [] };

    const users = await this.userRepository.findAll();
    const ownerMap = new Map(users.map((u) => [u.id, u]));

    return {
      items: rows.map(({ share, qrCode }) => ({
        qrCode,
        sharedBy: { id: share.ownerId, name: ownerMap.get(share.ownerId)?.name ?? '' },
      })),
    };
  }
}
