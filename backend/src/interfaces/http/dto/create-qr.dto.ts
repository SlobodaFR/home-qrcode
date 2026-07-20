import { IsDateString, IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, Matches, Max, Min, ValidateIf } from 'class-validator';

export class CreateQrDto {
  @IsIn(['url', 'text', 'wifi', 'email', 'vcard'])
  contentType!: 'url' | 'text' | 'wifi' | 'email' | 'vcard';

  // url / text
  @ValidateIf(o => (o as CreateQrDto).contentType === 'url' || (o as CreateQrDto).contentType === 'text')
  @IsNotEmpty()
  @ValidateIf(o => (o as CreateQrDto).contentType === 'url')
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  content?: string;

  // wifi
  @ValidateIf(o => (o as CreateQrDto).contentType === 'wifi')
  @IsNotEmpty()
  @IsString()
  ssid?: string;

  @ValidateIf(o => (o as CreateQrDto).contentType === 'wifi')
  @IsIn(['WPA', 'WEP', 'nopass'])
  security?: 'WPA' | 'WEP' | 'nopass';

  @ValidateIf(o => (o as CreateQrDto).contentType === 'wifi' && (o as CreateQrDto).security !== 'nopass')
  @IsNotEmpty()
  @IsString()
  password?: string;

  // email
  @ValidateIf(o => (o as CreateQrDto).contentType === 'email')
  @IsEmail()
  to?: string;

  @ValidateIf(o => (o as CreateQrDto).contentType === 'email')
  @IsOptional()
  @IsString()
  subject?: string;

  @ValidateIf(o => (o as CreateQrDto).contentType === 'email')
  @IsOptional()
  @IsString()
  body?: string;

  // vcard
  @ValidateIf(o => (o as CreateQrDto).contentType === 'vcard')
  @IsNotEmpty()
  @IsString()
  name?: string;

  @ValidateIf(o => (o as CreateQrDto).contentType === 'vcard')
  @IsOptional()
  @IsString()
  phone?: string;

  @ValidateIf(o => (o as CreateQrDto).contentType === 'vcard')
  @IsOptional()
  @IsEmail()
  vcardEmail?: string;

  @ValidateIf(o => (o as CreateQrDto).contentType === 'vcard')
  @IsOptional()
  @IsString()
  org?: string;

  // display options (shared)
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

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
