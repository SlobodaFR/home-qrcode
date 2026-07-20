import { Injectable } from '@nestjs/common';
import { QrCode } from '../../domain/qr/qr-code';
import { QrRepository } from '../../domain/qr/qr.repository';

export interface ListLinksCommand {
  userId: string;
  page: number;
  limit: number;
}

export interface ListLinksResult {
  items: QrCode[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class ListLinksUseCase {
  constructor(private readonly repository: QrRepository) {}

  async execute(cmd: ListLinksCommand): Promise<ListLinksResult> {
    const { items, total } = await this.repository.findAllLinksByUserId(cmd.userId, {
      page: cmd.page,
      limit: cmd.limit,
    });
    return { items, total, page: cmd.page, limit: cmd.limit };
  }
}
