import { Body, Controller, Delete, Get, HttpCode, Inject, NotFoundException, Param, Patch, Post, Query, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Readable } from 'stream';
import { ConfigService } from '@nestjs/config';
import { SetExpirationUseCase } from '../../../application/expiration/set-expiration.use-case';
import { AttachLogoUseCase } from '../../../application/qr/attach-logo.use-case';
import { DeleteQrUseCase } from '../../../application/qr/delete-qr.use-case';
import { EditTargetUrlUseCase } from '../../../application/qr/edit-target-url.use-case';
import { GenerateQrUseCase } from '../../../application/qr/generate-qr.use-case';
import { ListQrUseCase } from '../../../application/qr/list-qr.use-case';
import { QrCode } from '../../../domain/qr/qr-code';
import { QrRepository } from '../../../domain/qr/qr.repository';
import { QrStoragePort } from '../../../domain/qr/qr-storage.port';
import { CurrentUser, CurrentUserPayload } from '../decorators/current-user.decorator';
import { Public } from '../decorators/public.decorator';
import { CreateQrDto } from '../dto/create-qr.dto';
import { EditTargetUrlDto } from '../dto/edit-target-url.dto';
import { ListQrDto } from '../dto/list-qr.dto';
import { SetExpirationDto } from '../dto/set-expiration.dto';
import { FileTypeValidator, ParseFilePipe } from '@nestjs/common';
import { parseExpiryDate } from '../utils/parse-expiry-date';

@Controller('qr')
export class QrController {
  constructor(
    private readonly generateQr: GenerateQrUseCase,
    private readonly attachLogo: AttachLogoUseCase,
    private readonly editTargetUrl: EditTargetUrlUseCase,
    private readonly listQr: ListQrUseCase,
    private readonly deleteQr: DeleteQrUseCase,
    private readonly qrRepository: QrRepository,
    private readonly storage: QrStoragePort,
    private readonly config: ConfigService,
    @Inject('SetExpirationUseCase') private readonly setExpirationUseCase: SetExpirationUseCase,
  ) {}

  @Public()
  @Get(':id/meta')
  async getMeta(@Param('id') id: string): Promise<Record<string, never>> {
    const qr = await this.qrRepository.findById(id);
    if (!qr) throw new NotFoundException();
    return {};
  }

  @Get()
  async list(@Query() dto: ListQrDto, @CurrentUser() user: CurrentUserPayload) {
    const result = await this.listQr.execute({ userId: user.id, page: dto.page, limit: dto.limit });
    return {
      items: result.items.map(toListItemResponse),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    await this.deleteQr.execute({ id, userId: user.id });
  }

  @Post()
  @HttpCode(201)
  async create(@Body() dto: CreateQrDto, @CurrentUser() user: CurrentUserPayload) {
    const base = {
      userId: user.id,
      size: dto.size,
      fgColor: dto.fgColor,
      bgColor: dto.bgColor,
      errorCorrection: dto.errorCorrection,
      frontendUrl: this.config.getOrThrow<string>('FRONTEND_URL'),
    };
    const expiresAt = dto.expiresAt ? parseExpiryDate(dto.expiresAt) : null;
    const { qr } = await this.generateQr.execute(
      dto.contentType === 'wifi'
        ? { ...base, contentType: 'wifi', wifi: { ssid: dto.ssid!, security: dto.security!, password: dto.password }, expiresAt }
        : dto.contentType === 'email'
          ? { ...base, contentType: 'email', emailFields: { to: dto.to!, subject: dto.subject, body: dto.body }, expiresAt }
          : dto.contentType === 'vcard'
            ? { ...base, contentType: 'vcard', vcard: { name: dto.name!, phone: dto.phone, email: dto.vcardEmail, org: dto.org }, expiresAt }
            : { ...base, contentType: dto.contentType, content: dto.content!, expiresAt },
    );
    return toResponse(qr);
  }

  @Patch(':id/expiration')
  async setExpiration(@Param('id') id: string, @Body() dto: SetExpirationDto, @CurrentUser() user: CurrentUserPayload) {
    const expiresAt = dto.expiresAt !== null ? parseExpiryDate(dto.expiresAt) : null;
    const { entity } = await this.setExpirationUseCase.execute({ id, userId: user.id, expiresAt });
    return toResponse(entity);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: EditTargetUrlDto, @CurrentUser() user: CurrentUserPayload) {
    const { qr } = await this.editTargetUrl.execute({ id, userId: user.id, content: dto.content });
    return toResponse(qr);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    const qr = await this.qrRepository.findByIdAndUserId(id, user.id);
    if (!qr) throw new NotFoundException();
    return toResponse(qr);
  }

  @Post(':id/logo')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('logo', { limits: { fileSize: 2_097_152 } }))
  async attachLogoEndpoint(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new FileTypeValidator({ fileType: /^image\/(png|jpeg|webp)$/ })],
      }),
    ) logo: Express.Multer.File,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const { qr } = await this.attachLogo.execute({
      id,
      userId: user.id,
      logoBuffer: logo.buffer,
      logoMimeType: logo.mimetype,
      frontendUrl: this.config.getOrThrow<string>('FRONTEND_URL'),
    });
    return toResponse(qr);
  }

  @Public()
  @Get(':id/logo')
  async streamLogo(@Param('id') id: string): Promise<StreamableFile> {
    const qr = await this.qrRepository.findById(id);
    if (!qr || !qr.hasLogo) throw new NotFoundException();
    const stream = await this.storage.streamLogo(id);
    return new StreamableFile(stream as unknown as Readable, {
      type: qr.logoMimeType ?? 'application/octet-stream',
      disposition: `inline; filename="logo-${id}"`,
    });
  }

  @Public()
  @Get(':id/png')
  async streamPng(@Param('id') id: string): Promise<StreamableFile> {
    const qr = await this.qrRepository.findById(id);
    if (!qr) throw new NotFoundException();
    if (!(await this.storage.exists(id))) throw new NotFoundException();
    const stream = await this.storage.streamPng(id);
    return new StreamableFile(stream as unknown as Readable, {
      type: 'image/png',
      disposition: `inline; filename="qr-${id}.png"`,
    });
  }

  @Public()
  @Get(':id/svg')
  async streamSvg(@Param('id') id: string): Promise<StreamableFile> {
    const qr = await this.qrRepository.findById(id);
    if (!qr) throw new NotFoundException();
    if (!(await this.storage.exists(id))) throw new NotFoundException();
    const stream = await this.storage.streamSvg(id);
    return new StreamableFile(stream as unknown as Readable, {
      type: 'image/svg+xml',
      disposition: `inline; filename="qr-${id}.svg"`,
    });
  }
}

function toListItemResponse(qr: QrCode) {
  const content = qr.content.length > 80 ? qr.content.slice(0, 80) + '…' : qr.content;
  return {
    id: qr.id,
    userId: qr.userId,
    contentType: qr.contentType,
    content,
    size: qr.size,
    fgColor: qr.fgColor,
    bgColor: qr.bgColor,
    errorCorrection: qr.errorCorrection,
    scanCount: qr.scanCount,
    hasLogo: qr.hasLogo,
    logoMimeType: qr.logoMimeType,
    expiresAt: qr.expiresAt?.toISOString() ?? null,
    createdAt: qr.createdAt,
    pngUrl: qr.pngUrl,
    svgUrl: qr.svgUrl,
  };
}

function toResponse(qr: QrCode) {
  return {
    id: qr.id,
    userId: qr.userId,
    contentType: qr.contentType,
    content: qr.content,
    size: qr.size,
    fgColor: qr.fgColor,
    bgColor: qr.bgColor,
    errorCorrection: qr.errorCorrection,
    scanCount: qr.scanCount,
    hasLogo: qr.hasLogo,
    logoMimeType: qr.logoMimeType,
    expiresAt: qr.expiresAt?.toISOString() ?? null,
    createdAt: qr.createdAt,
    pngUrl: qr.pngUrl,
    svgUrl: qr.svgUrl,
  };
}
