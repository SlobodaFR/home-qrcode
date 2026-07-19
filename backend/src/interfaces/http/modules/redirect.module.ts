import { Module } from '@nestjs/common';
import { RedirectUseCase } from '../../../application/redirect/redirect.use-case';
import { RedirectController } from '../controllers/redirect.controller';
import { QrModule } from './qr.module';

@Module({
  imports: [QrModule],
  controllers: [RedirectController],
  providers: [RedirectUseCase],
})
export class RedirectModule {}
