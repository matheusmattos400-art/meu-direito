import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@app/db';

export const ROLES_KEY = 'roles';

/** Restringe a rota aos papéis informados (RBAC). */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
