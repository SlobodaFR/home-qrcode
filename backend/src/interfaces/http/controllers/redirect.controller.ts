import { Controller, Get, Param, Redirect } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { RedirectUseCase } from '../../../application/redirect/redirect.use-case';
import { Public } from '../decorators/public.decorator';

// Public scan route: a printed QR code can be scanned by many people behind one IP.
@SkipThrottle()
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
