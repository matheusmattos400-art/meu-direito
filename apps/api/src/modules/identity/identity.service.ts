import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import type { User } from '@app/db';
import type { LawyerRegistrationInput } from '@app/validation';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

export interface UserProfile {
  id: string;
  role: User['role'];
  status: User['status'];
  email: string | null;
  fullName: string | null;
}

@Injectable()
export class IdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  toProfile(user: User): UserProfile {
    return {
      id: user.id,
      role: user.role,
      status: user.status,
      email: user.email,
      fullName: user.fullName,
    };
  }

  /**
   * Registra o perfil de advogado para um usuário existente.
   * - Valida as áreas de atuação (categorias) por slug.
   * - Cria o Lawyer (verificação PENDING), as especialidades e promove o papel.
   * Observação (OAB): a verificação da OAB é concluída pelo backoffice.
   */
  async registerLawyer(user: User, dto: LawyerRegistrationInput) {
    const existing = await this.prisma.lawyer.findUnique({ where: { userId: user.id } });
    if (existing) {
      throw new ConflictException('Perfil de advogado já cadastrado.');
    }

    const categories = await this.prisma.category.findMany({
      where: { slug: { in: dto.specialties } },
    });
    if (categories.length !== dto.specialties.length) {
      throw new BadRequestException('Uma ou mais áreas de atuação são inválidas.');
    }

    const lawyer = await this.prisma.$transaction(async (tx) => {
      const created = await tx.lawyer.create({
        data: {
          userId: user.id,
          oabNumber: dto.oabNumber,
          oabState: dto.oabState.toUpperCase(),
        },
      });

      await tx.lawyerSpecialty.createMany({
        data: categories.map((c) => ({ lawyerId: created.id, categoryId: c.id })),
      });

      // Etapas padrão do Kanban (configuráveis depois pelo advogado).
      await tx.kanbanStage.createMany({
        data: [
          { lawyerId: created.id, name: 'Triagem', order: 0 },
          { lawyerId: created.id, name: 'Petição', order: 1 },
          { lawyerId: created.id, name: 'Audiência', order: 2 },
          { lawyerId: created.id, name: 'Concluído', order: 3 },
        ],
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          role: 'LAWYER',
          fullName: dto.fullName,
          status: 'PENDING_VERIFICATION',
        },
      });

      return created;
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: 'LAWYER',
      action: 'LAWYER_REGISTER',
      entityType: 'Lawyer',
      entityId: lawyer.id,
      metadata: { oabState: lawyer.oabState, specialties: dto.specialties },
    });

    return {
      lawyerId: lawyer.id,
      verification: lawyer.verification,
    };
  }
}
