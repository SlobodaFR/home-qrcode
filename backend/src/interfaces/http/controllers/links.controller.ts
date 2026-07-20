import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreateLinkUseCase } from '../../../application/links/create-link.use-case';
import { DeleteLinkUseCase } from '../../../application/links/delete-link.use-case';
import { EditLinkUseCase } from '../../../application/links/edit-link.use-case';
import { ListLinksUseCase } from '../../../application/links/list-links.use-case';
import { QrCode } from '../../../domain/qr/qr-code';
import { CurrentUser, CurrentUserPayload } from '../decorators/current-user.decorator';
import { CreateOrEditLinkDto } from '../dto/create-or-edit-link.dto';
import { ListQrDto } from '../dto/list-qr.dto';

@Controller('links')
export class LinksController {
  constructor(
    private readonly createLink: CreateLinkUseCase,
    private readonly listLinks: ListLinksUseCase,
    private readonly editLink: EditLinkUseCase,
    private readonly deleteLink: DeleteLinkUseCase,
    private readonly config: ConfigService,
  ) {}

  @Post()
  @HttpCode(201)
  async create(@Body() dto: CreateOrEditLinkDto, @CurrentUser() user: CurrentUserPayload) {
    const { link } = await this.createLink.execute({ userId: user.id, url: dto.url });
    return toResponse(link, this.config.getOrThrow<string>('FRONTEND_URL'));
  }

  @Get()
  async list(@Query() dto: ListQrDto, @CurrentUser() user: CurrentUserPayload) {
    const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL');
    const result = await this.listLinks.execute({ userId: user.id, page: dto.page, limit: dto.limit });
    return {
      items: result.items.map((l) => toResponse(l, frontendUrl)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: CreateOrEditLinkDto, @CurrentUser() user: CurrentUserPayload) {
    const { link } = await this.editLink.execute({ id, userId: user.id, url: dto.url });
    return toResponse(link, this.config.getOrThrow<string>('FRONTEND_URL'));
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    await this.deleteLink.execute({ id, userId: user.id });
  }
}

function toResponse(link: QrCode, frontendUrl: string) {
  return {
    id: link.id,
    url: link.content,
    shortUrl: `${frontendUrl}/r/${link.id}`,
    scanCount: link.scanCount,
    createdAt: link.createdAt,
  };
}
