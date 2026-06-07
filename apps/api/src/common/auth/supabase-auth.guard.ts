import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import type { AuthenticatedRequest } from './authenticated-request';

/**
 * Autenticação via JWT do Supabase Auth.
 *
 * 1. Valida o Bearer token com o SUPABASE_JWT_SECRET.
 * 2. Provisiona o usuário local na primeira vez (just-in-time), mapeando
 *    o `sub` do token para `User.authUserId`.
 * 3. Anexa `authUser` (token) e `user` (banco) ao request.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de autenticação ausente.');
    }

    const secret = this.config.get<string>('SUPABASE_JWT_SECRET');
    if (!secret) {
      throw new UnauthorizedException('Autenticação não configurada no servidor.');
    }

    const token = header.slice('Bearer '.length);
    let payload: jwt.JwtPayload;
    try {
      const decoded = jwt.verify(token, secret);
      if (typeof decoded === 'string' || !decoded.sub) {
        throw new Error('payload inválido');
      }
      payload = decoded;
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado.');
    }

    const authUserId = payload.sub as string;
    const email = typeof payload.email === 'string' ? payload.email : undefined;
    const isAdmin = email !== undefined && this.adminEmails().includes(email.toLowerCase());

    let user = await this.prisma.user.upsert({
      where: { authUserId },
      update: {},
      create: { authUserId, email: email ?? null, role: isAdmin ? 'ADMIN' : 'CITIZEN' },
    });

    // Promove a ADMIN se o e-mail estiver na allowlist e ainda não for admin.
    if (isAdmin && user.role !== 'ADMIN') {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { role: 'ADMIN' },
      });
    }

    request.authUser = { id: authUserId, email };
    request.user = user;
    return true;
  }

  private adminEmails(): string[] {
    return (this.config.get<string>('ADMIN_EMAILS') ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  }
}
