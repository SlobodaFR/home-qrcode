import { Injectable } from '@nestjs/common';
import { QrCode } from '../../domain/qr/qr-code';
import { QrImageGenerator } from '../../domain/qr/qr-image-generator';
import { QrRepository } from '../../domain/qr/qr.repository';
import { QrStoragePort } from '../../domain/qr/qr-storage.port';
import { EmailFields, VcardFields, WifiFields, encodeEmail, encodeVcard, encodeWifi } from './qr-content.encoder';

type DisplayOptions = {
  size: number;
  fgColor: string;
  bgColor: string;
  errorCorrection: 'L' | 'M' | 'Q' | 'H';
};

type BaseCmd = { userId: string; frontendUrl: string } & DisplayOptions;

export type GenerateQrCommand =
  | (BaseCmd & { contentType: 'url'; content: string })
  | (BaseCmd & { contentType: 'text'; content: string })
  | (BaseCmd & { contentType: 'wifi'; wifi: WifiFields })
  | (BaseCmd & { contentType: 'email'; emailFields: EmailFields })
  | (BaseCmd & { contentType: 'vcard'; vcard: VcardFields });

export interface GenerateQrResult {
  qr: QrCode;
}

@Injectable()
export class GenerateQrUseCase {
  constructor(
    private readonly generator: QrImageGenerator,
    private readonly storage: QrStoragePort,
    private readonly repository: QrRepository,
  ) {}

  async execute(cmd: GenerateQrCommand): Promise<GenerateQrResult> {
    const id = crypto.randomUUID();

    let encodedContent: string;
    let storedContent: string;

    if (cmd.contentType === 'url') {
      encodedContent = `${cmd.frontendUrl}/r/${id}`;
      storedContent = cmd.content;
    } else if (cmd.contentType === 'text') {
      encodedContent = cmd.content;
      storedContent = cmd.content;
    } else if (cmd.contentType === 'wifi') {
      encodedContent = encodeWifi(cmd.wifi);
      storedContent = cmd.wifi.ssid;
    } else if (cmd.contentType === 'email') {
      encodedContent = encodeEmail(cmd.emailFields);
      storedContent = cmd.emailFields.to;
    } else {
      encodedContent = encodeVcard(cmd.vcard);
      storedContent = cmd.vcard.name;
    }

    const { png, svg } = await this.generator.generate(encodedContent, {
      size: cmd.size,
      fgColor: cmd.fgColor,
      bgColor: cmd.bgColor,
      errorCorrection: cmd.errorCorrection,
    });

    await this.storage.uploadPng(id, png);
    await this.storage.uploadSvg(id, svg);

    const qr = QrCode.create({
      id,
      userId: cmd.userId,
      contentType: cmd.contentType,
      content: storedContent,
      encodedContent,
      hasLogo: false,
      source: 'qr',
      size: cmd.size,
      fgColor: cmd.fgColor,
      bgColor: cmd.bgColor,
      errorCorrection: cmd.errorCorrection,
      createdAt: new Date(),
    });

    await this.repository.save(qr);
    return { qr };
  }
}
