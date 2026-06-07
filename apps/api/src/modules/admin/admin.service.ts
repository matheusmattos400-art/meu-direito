import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@app/db';
import type { RejectLawyerInput } from '@app/validation';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { StorageService } from '../../common/storage/storage.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  // ---------------- Advogados (ciclo de conta) ----------------
  /** Lista todos os advogados com dados de cartão: nome, área, nº processos, status, estado. */
  async listLawyers() {
    const lawyers = await this.prisma.lawyer.findMany({
      include: {
        user: true,
        specialties: { include: { category: true } },
        _count: { select: { monitorings: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return lawyers.map((l) => ({
      lawyerId: l.id,
      name: l.user.fullName,
      email: l.user.email,
      oab: `${l.oabNumber}/${l.oabState}`,
      state: l.oabState,
      specialties: l.specialties.map((s) => s.category.name),
      processCount: l._count.monitorings,
      status: l.status,
      submittedAt: l.submittedAt,
    }));
  }

  /** Ficha completa do advogado (formulário + documentos com download). */
  async getLawyerDetail(lawyerId: string) {
    const l = await this.prisma.lawyer.findUnique({
      where: { id: lawyerId },
      include: {
        user: true,
        specialties: { include: { category: true } },
        verificationDocuments: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!l) throw new NotFoundException('Advogado não encontrado.');

    return {
      lawyerId: l.id,
      status: l.status,
      profile: {
        fullName: l.user.fullName,
        cpf: l.cpf,
        email: l.user.email,
        phone: l.phone,
        phone2: l.phone2,
        birthDate: l.birthDate,
        oab: `${l.oabNumber}/${l.oabState}`,
        residentialAddress: l.residentialAddress,
        professionalAddress: l.professionalAddress,
        specialties: l.specialties.map((s) => s.category.name),
      },
      term: { accepted: l.termAccepted, acceptedAt: l.termAcceptedAt },
      submittedAt: l.submittedAt,
      documents: await Promise.all(
        l.verificationDocuments.map(async (d) => ({
          id: d.id,
          kind: d.kind,
          fileName: d.fileName,
          downloadUrl: await this.storage.createDownloadUrl(d.storageKey),
        })),
      ),
    };
  }

  private async setLawyerStatus(
    admin: User,
    lawyerId: string,
    status: 'ACTIVE' | 'REJECTED' | 'CANCELED',
    action: string,
    meta?: Record<string, unknown>,
  ) {
    const lawyer = await this.prisma.lawyer.findUnique({ where: { id: lawyerId } });
    if (!lawyer) throw new NotFoundException('Advogado não encontrado.');

    await this.prisma.$transaction([
      this.prisma.lawyer.update({
        where: { id: lawyerId },
        data: { status, decidedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: lawyer.userId },
        data: { status: status === 'ACTIVE' ? 'ACTIVE' : 'SUSPENDED' },
      }),
    ]);

    await this.audit.log({
      actorId: admin.id,
      actorRole: 'ADMIN',
      action,
      entityType: 'Lawyer',
      entityId: lawyerId,
      metadata: meta,
    });
    return { lawyerId, status };
  }

  activateLawyer(admin: User, lawyerId: string) {
    return this.setLawyerStatus(admin, lawyerId, 'ACTIVE', 'LAWYER_ACTIVATE');
  }

  rejectLawyer(admin: User, lawyerId: string, dto: RejectLawyerInput) {
    return this.setLawyerStatus(admin, lawyerId, 'REJECTED', 'LAWYER_REJECT', {
      reason: dto.reason,
    });
  }

  cancelLawyer(admin: User, lawyerId: string) {
    return this.setLawyerStatus(admin, lawyerId, 'CANCELED', 'LAWYER_CANCEL');
  }

  // ---------------- Usuários / auditoria ----------------
  async listUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return users.map((u) => ({
      id: u.id,
      role: u.role,
      status: u.status,
      email: u.email,
      fullName: u.fullName,
      createdAt: u.createdAt,
    }));
  }

  /** Promove um usuário a ADMIN (acesso interno; não exige OAB). */
  async promoteToAdmin(admin: User, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    await this.prisma.user.update({ where: { id: userId }, data: { role: 'ADMIN' } });
    await this.audit.log({
      actorId: admin.id,
      actorRole: 'ADMIN',
      action: 'ADMIN_GRANT',
      entityType: 'User',
      entityId: userId,
    });
    return { userId, role: 'ADMIN' };
  }

  /** Rebaixa um ADMIN de volta a CITIZEN (sem auto-rebaixamento). */
  async revokeAdmin(admin: User, userId: string) {
    if (admin.id === userId) {
      throw new BadRequestException('Você não pode remover o seu próprio acesso de administrador.');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    await this.prisma.user.update({ where: { id: userId }, data: { role: 'CITIZEN' } });
    await this.audit.log({
      actorId: admin.id,
      actorRole: 'ADMIN',
      action: 'ADMIN_REVOKE',
      entityType: 'User',
      entityId: userId,
    });
    return { userId, role: 'CITIZEN' };
  }

  async listAuditLogs() {
    const logs = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return logs.map((l) => ({
      id: l.id,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      actorRole: l.actorRole,
      createdAt: l.createdAt,
    }));
  }

  // ---------------- BI / dashboards ----------------
  async stats() {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [newUsers, byStatus, byCategoryRaw, byCityRaw, qualifiedOrBeyond, assignedOrBeyond] =
      await Promise.all([
        this.prisma.user.count({ where: { createdAt: { gte: since } } }),
        this.prisma.case.groupBy({
          by: ['status'],
          _count: { _all: true },
          where: { deletedAt: null },
        }),
        this.prisma.case.groupBy({
          by: ['categoryId'],
          _count: { _all: true },
          where: { deletedAt: null, categoryId: { not: null } },
        }),
        this.prisma.case.groupBy({
          by: ['city', 'state'],
          _count: { _all: true },
          where: { deletedAt: null, city: { not: null } },
        }),
        this.prisma.case.count({
          where: { status: { in: ['QUALIFIED', 'AVAILABLE', 'ASSIGNED', 'IN_PROGRESS', 'CLOSED'] } },
        }),
        this.prisma.case.count({
          where: { status: { in: ['ASSIGNED', 'IN_PROGRESS', 'CLOSED'] } },
        }),
      ]);

    // resolve nomes de categorias
    const categoryIds = byCategoryRaw
      .map((g) => g.categoryId)
      .filter((id): id is string => id !== null);
    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
    });
    const categoryName = new Map(categories.map((c) => [c.id, c.name]));

    const conversionRate =
      qualifiedOrBeyond > 0 ? Math.round((assignedOrBeyond / qualifiedOrBeyond) * 100) : 0;

    return {
      newUsers30d: newUsers,
      conversionRatePct: conversionRate,
      casesByStatus: byStatus.map((g) => ({ status: g.status, count: g._count._all })),
      casesByCategory: byCategoryRaw.map((g) => ({
        category: g.categoryId ? (categoryName.get(g.categoryId) ?? '—') : '—',
        count: g._count._all,
      })),
      casesByCity: byCityRaw.map((g) => ({
        city: g.city,
        state: g.state,
        count: g._count._all,
      })),
    };
  }
}
