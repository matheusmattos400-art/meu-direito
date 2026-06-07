import { SetMetadata } from '@nestjs/common';

/** Abas/áreas do backoffice controladas por escopo. */
export type AdminScope = 'ADVOGADOS' | 'FINANCEIRO' | 'USUARIOS' | 'SUPORTE';
export const ADMIN_SCOPES: AdminScope[] = ['ADVOGADOS', 'FINANCEIRO', 'USUARIOS', 'SUPORTE'];

export const REQUIRE_SCOPE = 'requireScope';
/** Exige que o admin tenha o escopo (ou seja o dono). */
export const RequireScope = (scope: AdminScope) => SetMetadata(REQUIRE_SCOPE, scope);

export const OWNER_ONLY = 'ownerOnly';
/** Exige que o usuário seja o administrador proprietário. */
export const OwnerOnly = () => SetMetadata(OWNER_ONLY, true);
