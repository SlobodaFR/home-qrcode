import { IsUrl } from 'class-validator';

export class EditTargetUrlDto {
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  content!: string;
}
