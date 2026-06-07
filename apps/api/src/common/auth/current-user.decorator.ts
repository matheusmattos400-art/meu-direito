import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { User } from '@app/db';
import type { AuthenticatedRequest } from './authenticated-request';

/** Injeta o usuário local (do banco) já resolvido pelo SupabaseAuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  },
);
