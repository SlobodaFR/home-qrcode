import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { QrImageGenerator, QrOptions } from '../../domain/qr/qr-image-generator';

@Injectable()
export class QrcodeImageGenerator extends QrImageGenerator {
  async generate(encodedContent: string, options: QrOptions): Promise<{ png: Buffer; svg: string }> {
    const qrOpts = {
      width: options.size,
      color: { dark: options.fgColor, light: options.bgColor },
      errorCorrectionLevel: options.errorCorrection,
    };
    const png = await QRCode.toBuffer(encodedContent, qrOpts);
    const svg = await QRCode.toString(encodedContent, { ...qrOpts, type: 'svg' });
    return { png, svg };
  }
}
