import { IsNotEmpty, IsString } from 'class-validator';

export class CreateShareDto {
  @IsString()
  @IsNotEmpty()
  recipientId!: string;
}
