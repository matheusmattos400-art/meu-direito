import { ConflictException, Injectable } from '@nestjs/common';
import type { User } from '@app/db';
import type { DeclineOpportunityInput } from '@app/validation';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { LawyerContextService } from '../../common/lawyer/lawyer-context.service';

@Injectable()
export class OportunidadesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly lawyerCtx: LawyerContextService,
  ) {}

  /**
   * Lista oportunidades de atendimento: casos QUALIFIED nas áreas de atuação
   * do advogado, ainda não atribuídos e não recusados por ele.
   * Não expõe identidade do cidadão antes do aceite.
   */
  async list(user: User) {
    const lawyer = await this.lawyerCtx.resolveVerified(user);

    const specialties = await this.prisma.lawyerSpecialty.findMany({
      where: { lawyerId: lawyer.id },
      select: { categoryId: true },
    });
    const categoryIds = specialties.map((s) => s.categoryId);
    if (categoryIds.length === 0) return [];

    const declined = await this.prisma.caseAssignment.findMany({
      where: { lawyerId: lawyer.id, status: 'DECLINED' },
      select: { caseId: true },
    });
    const declinedIds = declined.map((d) => d.caseId);

    const cases = await this.prisma.case.findMany({
      where: {
        status: 'QUALIFIED',
        deletedAt: null,
        categoryId: { in: categoryIds },
        ...(declinedIds.length > 0 ? { id: { notIn: declinedIds } } : {}),
      },
      include: { category: true, subcategory: true },
      orderBy: { createdAt: 'asc' },
    });

    return cases.map((c) => ({
      caseId: c.id,
      protocol: c.protocol,
      category: c.category?.name ?? null,
      subcategory: c.subcategory?.name ?? null,
      potential: c.potential,
      summary: c.aiSummary,
      city: c.city,
      state: c.state,
      createdAt: c.createdAt,
    }));
  }

  /** Aceita a oportunidade: cria a atribuição e move o caso para ASSIGNED. */
  async accept(user: User, caseId: string) {
    const lawyer = await this.lawyerCtx.resolveVerified(user);

    const firstStage = await this.prisma.kanbanStage.findFirst({
      where: { lawyerId: lawyer.id },
      orderBy: { order: 'asc' },
    });

    const assignment = await this.prisma.$transaction(async (tx) => {
      const caseRecord = await tx.case.findFirst({
        where: { id: caseId, status: 'QUALIFIED', deletedAt: null },
      });
      if (!caseRecord) {
        throw new ConflictException('Caso indisponível (já atribuído ou inválido).');
      }

      const created = await tx.caseAssignment.upsert({
        where: { caseId_lawyerId: { caseId, lawyerId: lawyer.id } },
        update: {
          status: 'ACCEPTED',
          respondedAt: new Date(),
          kanbanStageId: firstStage?.id ?? null,
        },
        create: {
          caseId,
          lawyerId: lawyer.id,
          status: 'ACCEPTED',
          respondedAt: new Date(),
          kanbanStageId: firstStage?.id ?? null,
        },
      });

      await tx.case.update({ where: { id: caseId }, data: { status: 'ASSIGNED' } });
      return created;
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'ACCEPT_CASE',
      entityType: 'Case',
      entityId: caseId,
      metadata: { assignmentId: assignment.id },
    });

    return { assignmentId: assignment.id, status: assignment.status };
  }

  /** Recusa a oportunidade (registra o motivo; não altera o caso). */
  async decline(user: User, caseId: string, dto: DeclineOpportunityInput) {
    const lawyer = await this.lawyerCtx.resolveVerified(user);

    const assignment = await this.prisma.caseAssignment.upsert({
      where: { caseId_lawyerId: { caseId, lawyerId: lawyer.id } },
      update: { status: 'DECLINED', respondedAt: new Date(), declineReason: dto.reason ?? null },
      create: {
        caseId,
        lawyerId: lawyer.id,
        status: 'DECLINED',
        respondedAt: new Date(),
        declineReason: dto.reason ?? null,
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'DECLINE_CASE',
      entityType: 'Case',
      entityId: caseId,
      metadata: { assignmentId: assignment.id, reason: dto.reason },
    });

    return { status: assignment.status };
  }
}
