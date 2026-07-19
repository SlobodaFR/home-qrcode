import { Controller, Get, Param, Redirect } from '@nestjs/common';
import { RedirectUseCase } from '../../../application/redirect/redirect.use-case';
import { Public } from '../decorators/public.decorator';

@Controller('r')
export class RedirectController {
  constructor(private readonly redirectUseCase: RedirectUseCase) {}

  @Public()
  @Get(':id')
  @Redirect()
  async redirect(@Param('id') id: string) {
    const { targetUrl } = await this.redirectUseCase.execute({ id });
    return { url: targetUrl, statusCode: 302 };
  }
}
