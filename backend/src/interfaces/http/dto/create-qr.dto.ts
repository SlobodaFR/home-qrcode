import { IsIn, IsInt, IsNotEmpty, IsOptional, IsUrl, Matches, Max, Min, ValidateIf } from 'class-validator';

export class CreateQrDto {
  @IsIn(['url', 'text'])
  contentType!: 'url' | 'text';

  @IsNotEmpty()
  @ValidateIf(o => (o as CreateQrDto).contentType === 'url')
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  content!: string;

  @IsOptional()
  @IsInt()
  @Min(128)
  @Max(4096)
  size: number = 1024;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  fgColor: string = '#000000';

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  bgColor: string = '#FFFFFF';

  @IsOptional()
  @IsIn(['L', 'M', 'Q', 'H'])
  errorCorrection: 'L' | 'M' | 'Q' | 'H' = 'M';
}
