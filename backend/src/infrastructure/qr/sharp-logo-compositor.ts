import { Injectable } from '@nestjs/common';
import * as sharp from 'sharp';
import { LogoCompositorPort } from '../../domain/qr/logo-compositor.port';

@Injectable()
export class SharpLogoCompositor extends LogoCompositorPort {
  async composite(qrPng: Buffer, logo: Buffer): Promise<Buffer> {
    const { width: qrWidth = 200 } = await sharp(qrPng).metadata();
    const logoSize = Math.round(qrWidth * 0.3);
    const resizedLogo = await sharp(logo)
      .resize(logoSize, logoSize, { fit: 'inside' })
      .toBuffer();
    return sharp(qrPng)
      .composite([{ input: resizedLogo, gravity: 'center' }])
      .png()
      .toBuffer();
  }
}
