import { Injectable } from '@nestjs/common';
import { QrCode } from '../../domain/qr/qr-code';
import { QrRepository } from '../../domain/qr/qr.repository';

export interface ListQrCommand {
  userId: string;
  page: number;
  limit: number;
}

export interface ListQrResult {
  items: QrCode[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class ListQrUseCase {
  constructor(private readonly repository: QrRepository) {}

  async execute(cmd: ListQrCommand): Promise<ListQrResult> {
    const { items, total } = await this.repository.findAllByUserId(cmd.userId, {
      page: cmd.page,
      limit: cmd.limit,
    });
    return { items, total, page: cmd.page, limit: cmd.limit };
  }
}
