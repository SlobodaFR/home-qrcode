import { QrCode } from './qr-code';

export interface FindAllOptions {
  page: number;
  limit: number;
}

export interface FindAllResult {
  items: QrCode[];
  total: number;
}

export abstract class QrRepository {
  abstract findById(id: string): Promise<QrCode | null>;
  abstract findByIdAndUserId(id: string, userId: string): Promise<QrCode | null>;
  abstract findAllByUserId(userId: string, options: FindAllOptions): Promise<FindAllResult>;
  abstract findAllLinksByUserId(userId: string, options: FindAllOptions): Promise<FindAllResult>;
  abstract save(qr: QrCode): Promise<void>;
  abstract deleteById(id: string, userId: string): Promise<boolean>;
  abstract incrementScanCount(id: string): Promise<void>;
}
