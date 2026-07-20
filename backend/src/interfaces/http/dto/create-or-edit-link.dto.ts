import { IsDateString, IsOptional, IsUrl } from 'class-validator';

export class CreateOrEditLinkDto {
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url!: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
