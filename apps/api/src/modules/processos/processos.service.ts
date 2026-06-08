import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { explainMovement } from '../../common/datajud/movement-glossary';
import type { ProcessMonitoring, User } from '@app/db';
import type { AddProcessInput } from '@app/validation';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { DatajudService } from '../../common/datajud/datajud.service';
import { LawyerContextService } from '../../common/lawyer/lawyer-context.service';

@Injectable()
export class ProcessosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly datajud: DatajudService,
    private readonly lawyerCtx: LawyerContextService,
  ) {}

  /** Adiciona um processo ao acompanhamento do usuário (cidadão ou advogado). */
  async add(user: User, dto: AddProcessInput) {
    const owner = await this.ownerFields(user);

    const monitoring = await this.prisma.processMonitoring.create({
      data: {
        ...owner,
        caseId: dto.caseId ?? null,
        processNumber: dto.processNumber,
        court: dto.court ?? null,
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'PROCESS_ADD',
      entityType: 'ProcessMonitoring',
      entityId: monitoring.id,
    });

    // primeira sincronização imediata
    await this.sync(user, monitoring.id);
    return this.toSummary(await this.prisma.processMonitoring.findUniqueOrThrow({ where: { id: monitoring.id } }));
  }

  async list(user: User) {
    const where = await this.ownerWhere(user);
    const items = await this.prisma.processMonitoring.findMany({
      where: { ...where, active: true },
      orderBy: { updatedAt: 'desc' },
    });
    return items.map((p) => this.toSummary(p));
  }

  async detail(user: User, id: string) {
    const monitoring = await this.loadOwned(user, id);
    const movements = await this.prisma.processMovement.findMany({
      where: { monitoringId: monitoring.id },
      orderBy: { createdAt: 'desc' },
    });
    return {
      ...this.toSummary(monitoring),
      movements: movements.map((m) => ({
        id: m.id,
        rawText: m.rawText,
        simplifiedText: m.simplifiedText,
        occurredAt: m.occurredAt,
      })),
    };
  }

  /** Consulta um processo no Datajud SEM salvar (prévia para a busca do advogado). */
  async preview(processNumber: string, court?: string) {
    const digits = (processNumber ?? '').replace(/\D/g, '');
    if (digits.length !== 20) {
      throw new BadRequestException('Número CNJ inválido — informe os 20 dígitos (NNNNNNN-DD.AAAA.J.TR.OOOO).');
    }
    const result = await this.datajud.fetchProcess(processNumber, court);
    const movements = result.movements.map((m) => ({
      rawText: m.rawText,
      explanation: explainMovement(m.rawText, m.cnjCode),
      occurredAt: m.occurredAt,
    }));
    movements.sort((a, b) => (b.occurredAt?.getTime?.() ?? 0) - (a.occurredAt?.getTime?.() ?? 0));
    return {
      processNumber,
      court: court ?? result.court ?? null,
      className: result.className ?? null,
      subject: result.subject ?? null,
      movements,
      demo: this.datajud.isMock(), // true = dados de exemplo (sem chave do Datajud)
      found: result.className != null || movements.length > 0,
    };
  }

  /** Busca movimentos no Datajud e traduz os novos para linguagem simples. */
  async sync(user: User, id: string) {
    const monitoring = await this.loadOwned(user, id);
    const result = await this.datajud.fetchProcess(monitoring.processNumber, monitoring.court ?? undefined);

    const existing = await this.prisma.processMovement.findMany({
      where: { monitoringId: monitoring.id },
      select: { rawText: true, cnjCode: true },
    });
    const seen = new Set(existing.map((e) => `${e.cnjCode ?? ''}|${e.rawText}`));

    let added = 0;
    for (const mov of result.movements) {
      const key = `${mov.cnjCode ?? ''}|${mov.rawText}`;
      if (seen.has(key)) continue;
      await this.prisma.processMovement.create({
        data: {
          monitoringId: monitoring.id,
          cnjCode: mov.cnjCode,
          rawText: mov.rawText,
          simplifiedText: explainMovement(mov.rawText, mov.cnjCode),
          occurredAt: mov.occurredAt,
        },
      });
      added += 1;
    }

    await this.prisma.processMonitoring.update({
      where: { id: monitoring.id },
      data: {
        court: monitoring.court ?? result.court,
        className: result.className,
        subject: result.subject,
        lastSyncedAt: new Date(),
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'PROCESS_SYNC',
      entityType: 'ProcessMonitoring',
      entityId: monitoring.id,
      metadata: { added },
    });

    return { added };
  }

  async remove(user: User, id: string) {
    const monitoring = await this.loadOwned(user, id);
    await this.prisma.processMonitoring.update({
      where: { id: monitoring.id },
      data: { active: false },
    });
    return { id: monitoring.id, active: false };
  }

  // ---------------- helpers (posse por papel) ----------------
  private async ownerFields(user: User): Promise<{ citizenId?: string; lawyerId?: string }> {
    if (user.role === 'LAWYER') {
      const lawyer = await this.lawyerCtx.resolve(user);
      return { lawyerId: lawyer.id };
    }
    return { citizenId: user.id };
  }

  private async ownerWhere(user: User): Promise<{ citizenId?: string; lawyerId?: string }> {
    return this.ownerFields(user);
  }

  private async loadOwned(user: User, id: string): Promise<ProcessMonitoring> {
    const where = await this.ownerWhere(user);
    const monitoring = await this.prisma.processMonitoring.findFirst({
      where: { id, ...where },
    });
    if (!monitoring) throw new NotFoundException('Processo não encontrado.');
    return monitoring;
  }

  private toSummary(p: ProcessMonitoring) {
    return {
      id: p.id,
      processNumber: p.processNumber,
      court: p.court,
      className: p.className,
      subject: p.subject,
      lastSyncedAt: p.lastSyncedAt,
    };
  }
}
