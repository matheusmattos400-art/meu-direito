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

    // Atalho de desenvolvimento: dispensa o JWT do Supabase. Só funciona com
    // DEV_AUTH_BYPASS=true e fora de produção. Provisiona o usuário pelo e-mail
    // informado no header x-dev-email (perfil via x-dev-role; ADMIN se na allowlist).
    if (await this.tryDevBypass(request)) return true;

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

    // Promove a ADMIN/owner se o e-mail estiver na allowlist.
    if (isAdmin && (user.role !== 'ADMIN' || !user.isOwner)) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { role: 'ADMIN', isOwner: true },
      });
    }

    request.authUser = { id: authUserId, email };
    request.user = user;
    return true;
  }

  /** Atalho de autenticação para desenvolvimento (gated). */
  private async tryDevBypass(request: AuthenticatedRequest): Promise<boolean> {
    const enabled =
      this.config.get<string>('DEV_AUTH_BYPASS') === 'true' &&
      this.config.get<string>('NODE_ENV') !== 'production';
    if (!enabled) return false;

    const raw = request.headers['x-dev-email'];
    const devEmail = (Array.isArray(raw) ? raw[0] : raw)?.toLowerCase();
    if (!devEmail) return false;

    const isAdmin = this.adminEmails().includes(devEmail);
    const roleHeader = request.headers['x-dev-role'];
    const requested = (Array.isArray(roleHeader) ? roleHeader[0] : roleHeader)?.toUpperCase();
    const allowed = ['CITIZEN', 'LAWYER', 'ADMIN'];
    const role = (isAdmin ? 'ADMIN' : allowed.includes(requested ?? '') ? requested : 'CITIZEN') as
      | 'CITIZEN'
      | 'LAWYER'
      | 'ADMIN';

    const user = await this.prisma.user.upsert({
      where: { email: devEmail },
      update: { role, ...(isAdmin ? { isOwner: true } : {}) },
      create: { email: devEmail, role, isOwner: isAdmin },
    });

    request.authUser = { id: user.authUserId ?? user.id, email: devEmail };
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
