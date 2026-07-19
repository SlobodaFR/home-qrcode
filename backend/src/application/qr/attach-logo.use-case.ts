import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { LogoCompositorPort } from '../../domain/qr/logo-compositor.port';
import { QrCode } from '../../domain/qr/qr-code';
import { QrImageGenerator } from '../../domain/qr/qr-image-generator';
import { QrRepository } from '../../domain/qr/qr.repository';
import { QrStoragePort } from '../../domain/qr/qr-storage.port';

export interface AttachLogoCommand {
  id: string;
  userId: string;
  logoBuffer: Buffer;
  logoMimeType: string;
  frontendUrl: string;
}

export interface AttachLogoResult {
  qr: QrCode;
}

@Injectable()
export class AttachLogoUseCase {
  constructor(
    private readonly generator: QrImageGenerator,
    private readonly storage: QrStoragePort,
    private readonly repository: QrRepository,
    private readonly compositor: LogoCompositorPort,
  ) {}

  async execute(cmd: AttachLogoCommand): Promise<AttachLogoResult> {
    const qr = await this.repository.findByIdAndUserId(cmd.id, cmd.userId);
    if (!qr) throw new NotFoundException();
    if (qr.hasLogo) throw new ConflictException();

    const encodedContent = this.resolveEncodedContent(qr, cmd.frontendUrl);

    const effectiveCorrection = (['L', 'M'] as const).includes(qr.errorCorrection as 'L' | 'M')
      ? ('Q' as const)
      : qr.errorCorrection;

    const { png } = await this.generator.generate(encodedContent, {
      size: qr.size,
      fgColor: qr.fgColor,
      bgColor: qr.bgColor,
      errorCorrection: effectiveCorrection,
    });

    const compositedPng = await this.compositor.composite(png, cmd.logoBuffer);

    await this.storage.uploadLogo(cmd.id, cmd.logoBuffer, cmd.logoMimeType);
    await this.storage.uploadPng(cmd.id, compositedPng);

    const updatedQr = qr.withLogo(effectiveCorrection, cmd.logoMimeType);
    await this.repository.save(updatedQr);

    return { qr: updatedQr };
  }

  private resolveEncodedContent(qr: QrCode, frontendUrl: string): string {
    if (qr.encodedContent !== null) return qr.encodedContent;
    if (qr.contentType === 'url') return `${frontendUrl}/r/${qr.id}`;
    if (qr.contentType === 'text') return qr.content;
    throw new UnprocessableEntityException(
      'Ce QR code a été créé avant le support des logos. Recréez-le pour ajouter un logo.',
    );
  }
}
