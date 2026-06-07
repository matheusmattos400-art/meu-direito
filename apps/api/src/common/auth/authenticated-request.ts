import type { Request } from 'express';
import type { User } from '@app/db';

export interface AuthUser {
  id: string; // sub do token (authUserId)
  email?: string;
}

/** Request após o SupabaseAuthGuard: traz o usuário do token e o usuário local. */
export interface AuthenticatedRequest extends Request {
  authUser: AuthUser;
  user: User;
}
