import { IsNotEmpty, IsString } from 'class-validator';

export class SessionRevokedDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;
}
