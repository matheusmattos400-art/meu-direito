import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@app/db';
import type { CreateKanbanStageInput, MoveKanbanCardInput } from '@app/validation';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { LawyerContextService } from '../../common/lawyer/lawyer-context.service';

@Injectable()
export class WorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly lawyerCtx: LawyerContextService,
  ) {}

  /** Board Kanban: etapas do advogado + casos aceitos como cards. */
  async board(user: User) {
    const lawyer = await this.lawyerCtx.resolve(user);

    const [stages, assignments] = await Promise.all([
      this.prisma.kanbanStage.findMany({
        where: { lawyerId: lawyer.id },
        orderBy: { order: 'asc' },
      }),
      this.prisma.caseAssignment.findMany({
        where: { lawyerId: lawyer.id, status: 'ACCEPTED' },
        include: { case: { include: { category: true } } },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const cards = assignments.map((a) => ({
      assignmentId: a.id,
      kanbanStageId: a.kanbanStageId,
      caseId: a.caseId,
      protocol: a.case.protocol,
      title: a.case.title ?? `Caso ${a.case.protocol}`,
      category: a.case.category?.name ?? null,
      potential: a.case.potential,
    }));

    return {
      stages: stages.map((s) => ({ id: s.id, name: s.name, order: s.order, color: s.color })),
      cards,
    };
  }

  async listStages(user: User) {
    const lawyer = await this.lawyerCtx.resolve(user);
    return this.prisma.kanbanStage.findMany({
      where: { lawyerId: lawyer.id },
      orderBy: { order: 'asc' },
    });
  }

  async createStage(user: User, dto: CreateKanbanStageInput) {
    const lawyer = await this.lawyerCtx.resolve(user);
    const last = await this.prisma.kanbanStage.findFirst({
      where: { lawyerId: lawyer.id },
      orderBy: { order: 'desc' },
    });
    const order = (last?.order ?? -1) + 1;

    return this.prisma.kanbanStage.create({
      data: { lawyerId: lawyer.id, name: dto.name, color: dto.color ?? null, order },
    });
  }

  /** Move um card para outra etapa (valida posse do card e da etapa). */
  async moveCard(user: User, assignmentId: string, dto: MoveKanbanCardInput) {
    const lawyer = await this.lawyerCtx.resolve(user);

    const assignment = await this.prisma.caseAssignment.findFirst({
      where: { id: assignmentId, lawyerId: lawyer.id },
    });
    if (!assignment) throw new NotFoundException('Card não encontrado.');

    const stage = await this.prisma.kanbanStage.findFirst({
      where: { id: dto.kanbanStageId, lawyerId: lawyer.id },
    });
    if (!stage) throw new ForbiddenException('Etapa inválida.');

    const updated = await this.prisma.caseAssignment.update({
      where: { id: assignmentId },
      data: { kanbanStageId: stage.id },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'KANBAN_MOVE_CARD',
      entityType: 'CaseAssignment',
      entityId: assignmentId,
      metadata: { toStage: stage.name },
    });

    return { assignmentId: updated.id, kanbanStageId: updated.kanbanStageId };
  }
}
