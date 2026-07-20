import { IsDateString, ValidateIf } from 'class-validator';

export class SetExpirationDto {
  @ValidateIf((o: SetExpirationDto) => o.expiresAt !== null)
  @IsDateString()
  expiresAt!: string | null;
}
