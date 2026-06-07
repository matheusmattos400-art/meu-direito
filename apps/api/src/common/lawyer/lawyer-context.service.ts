import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Lawyer, User } from '@app/db';
import { PrismaService } from '../prisma/prisma.service';

/** Resolve o perfil de advogado do usuário autenticado. */
@Injectable()
export class LawyerContextService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(user: User): Promise<Lawyer> {
    const lawyer = await this.prisma.lawyer.findUnique({ where: { userId: user.id } });
    if (!lawyer) {
      throw new ForbiddenException('Perfil de advogado não encontrado.');
    }
    return lawyer;
  }

  /** Exige advogado com OAB verificada (ética/segurança). */
  async resolveVerified(user: User): Promise<Lawyer> {
    const lawyer = await this.resolve(user);
    if (lawyer.verification !== 'VERIFIED') {
      throw new ForbiddenException(
        'Seu cadastro de advogado ainda está em verificação. Aguarde a validação da OAB.',
      );
    }
    return lawyer;
  }
}
