import { Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@app/db';
import type { RejectLawyerInput } from '@app/validation';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---------------- Validação de OAB ----------------
  async listPendingLawyers() {
    const lawyers = await this.prisma.lawyer.findMany({
      where: { verification: 'PENDING' },
      include: { user: true, specialties: { include: { category: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return lawyers.map((l) => ({
      lawyerId: l.id,
      name: l.user.fullName,
      email: l.user.email,
      oab: `${l.oabNumber}/${l.oabState}`,
      specialties: l.specialties.map((s) => s.category.name),
      createdAt: l.createdAt,
    }));
  }

  async verifyLawyer(admin: User, lawyerId: string) {
    const lawyer = await this.prisma.lawyer.findUnique({ where: { id: lawyerId } });
    if (!lawyer) throw new NotFoundException('Advogado não encontrado.');

    await this.prisma.$transaction([
      this.prisma.lawyer.update({
        where: { id: lawyerId },
        data: { verification: 'VERIFIED', verifiedAt: new Date() },
      }),
      this.prisma.user.update({ where: { id: lawyer.userId }, data: { status: 'ACTIVE' } }),
    ]);

    await this.audit.log({
      actorId: admin.id,
      actorRole: 'ADMIN',
      action: 'OAB_VERIFY',
      entityType: 'Lawyer',
      entityId: lawyerId,
    });
    return { lawyerId, verification: 'VERIFIED' };
  }

  async rejectLawyer(admin: User, lawyerId: string, dto: RejectLawyerInput) {
    const lawyer = await this.prisma.lawyer.findUnique({ where: { id: lawyerId } });
    if (!lawyer) throw new NotFoundException('Advogado não encontrado.');

    await this.prisma.lawyer.update({
      where: { id: lawyerId },
      data: { verification: 'REJECTED' },
    });

    await this.audit.log({
      actorId: admin.id,
      actorRole: 'ADMIN',
      action: 'OAB_REJECT',
      entityType: 'Lawyer',
      entityId: lawyerId,
      metadata: { reason: dto.reason },
    });
    return { lawyerId, verification: 'REJECTED' };
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
