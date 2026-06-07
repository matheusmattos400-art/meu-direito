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

  /** Exige advogado com conta ATIVA (cadastro aprovado pelo backoffice). */
  async resolveVerified(user: User): Promise<Lawyer> {
    const lawyer = await this.resolve(user);
    if (lawyer.status !== 'ACTIVE') {
      throw new ForbiddenException(
        'Seu cadastro ainda não está ativo. Conclua o envio de documentos e aguarde a análise.',
      );
    }
    return lawyer;
  }
}
