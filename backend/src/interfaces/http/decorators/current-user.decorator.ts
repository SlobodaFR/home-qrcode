import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface CurrentUserPayload {
  id: string;
  email: string;
  name: string;
}

export interface AuthenticatedRequest extends Request {
  cookies: Record<string, string | undefined>;
  user?: CurrentUserPayload;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserPayload => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user!;
  },
);
