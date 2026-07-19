import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Patch, Post, Query, StreamableFile } from '@nestjs/common';
import { Readable } from 'stream';
import { ConfigService } from '@nestjs/config';
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

@Controller('qr')
export class QrController {
  constructor(
    private readonly generateQr: GenerateQrUseCase,
    private readonly editTargetUrl: EditTargetUrlUseCase,
    private readonly listQr: ListQrUseCase,
    private readonly deleteQr: DeleteQrUseCase,
    private readonly qrRepository: QrRepository,
    private readonly storage: QrStoragePort,
    private readonly config: ConfigService,
  ) {}

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
    const { qr } = await this.generateQr.execute({
      userId: user.id,
      contentType: dto.contentType,
      content: dto.content,
      size: dto.size,
      fgColor: dto.fgColor,
      bgColor: dto.bgColor,
      errorCorrection: dto.errorCorrection,
      frontendUrl: this.config.getOrThrow<string>('FRONTEND_URL'),
    });
    return toResponse(qr);
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
    createdAt: qr.createdAt,
    pngUrl: qr.pngUrl,
    svgUrl: qr.svgUrl,
  };
}
