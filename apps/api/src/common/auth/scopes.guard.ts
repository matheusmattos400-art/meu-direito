import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from './authenticated-request';
import { OWNER_ONLY, REQUIRE_SCOPE, type AdminScope } from './scopes.decorator';

/**
 * Autorização por escopo de backoffice. O administrador proprietário (owner)
 * tem acesso total. Demais admins precisam do escopo correspondente.
 * Rotas marcadas com @OwnerOnly() exigem ser o dono.
 */
@Injectable()
export class ScopesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const ownerOnly = this.reflector.getAllAndOverride<boolean>(OWNER_ONLY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const scope = this.reflector.getAllAndOverride<AdminScope>(REQUIRE_SCOPE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!ownerOnly && !scope) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) throw new ForbiddenException('Não autenticado.');
    if (user.isOwner) return true; // dono acessa tudo

    if (ownerOnly) {
      throw new ForbiddenException('Apenas o administrador proprietário pode fazer isso.');
    }
    const scopes = Array.isArray(user.adminScopes) ? (user.adminScopes as string[]) : [];
    if (scope && scopes.includes(scope)) return true;
    throw new ForbiddenException('Você não tem acesso a esta área.');
  }
}
