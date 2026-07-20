import { QrCode } from './qr-code';
import { QrShare } from './qr-share';

export abstract class QrShareRepository {
  abstract save(share: QrShare): Promise<void>;
  abstract findById(shareId: string): Promise<QrShare | null>;
  abstract findByQrAndRecipient(qrId: string, recipientId: string): Promise<QrShare | null>;
  abstract findByQrIds(qrIds: string[]): Promise<QrShare[]>;
  abstract findWithQrByRecipientId(recipientId: string): Promise<{ share: QrShare; qrCode: QrCode }[]>;
  abstract deleteById(shareId: string): Promise<void>;
  abstract deleteByQrId(qrId: string): Promise<void>;
}
