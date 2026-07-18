import { QrCode } from './qr-code';

export abstract class QrRepository {
  abstract findById(id: string): Promise<QrCode | null>;
  abstract findByIdAndUserId(id: string, userId: string): Promise<QrCode | null>;
  abstract save(qr: QrCode): Promise<void>;
}
