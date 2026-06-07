import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@app/db';
import type {
  AdminCreateLawyerInput,
  CreateAdminInput,
  CreatePlanInput,
  RejectLawyerInput,
} from '@app/validation';
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
      city: l.city,
      avatarUrl: l.avatarUrl,
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
        assignments: {
          where: { status: 'ACCEPTED' },
          orderBy: { updatedAt: 'desc' },
          include: { case: { include: { citizen: true, category: true } } },
        },
      },
    });
    if (!l) throw new NotFoundException('Advogado não encontrado.');

    return {
      lawyerId: l.id,
      status: l.status,
      credentials: {
        email: l.user.email,
        // Senha provisória só existe para cadastros criados pelo backoffice.
        provisionalPassword: l.provisionalPassword,
        createdByAdmin: l.createdByAdmin,
      },
      profile: {
        fullName: l.user.fullName,
        cpf: l.cpf,
        email: l.user.email,
        phone: l.phone,
        phone2: l.phone2,
        birthDate: l.birthDate,
        city: l.city,
        avatarUrl: l.avatarUrl,
        oab: `${l.oabNumber}/${l.oabState}`,
        residentialAddress: l.residentialAddress,
        professionalAddress: l.professionalAddress,
        specialties: l.specialties.map((s) => s.category.name),
      },
      term: { accepted: l.termAccepted, acceptedAt: l.termAcceptedAt },
      submittedAt: l.submittedAt,
      clients: l.assignments.map((a) => ({
        caseId: a.caseId,
        protocol: a.case.protocol,
        clientName: a.case.citizen.fullName ?? a.case.citizen.email,
        category: a.case.category?.name ?? null,
        caseStatus: a.case.status,
      })),
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

  /** Cria um advogado diretamente (sem o formulário público), com login e senha. */
  async createLawyer(admin: User, dto: AdminCreateLawyerInput) {
    const categories = await this.prisma.category.findMany({
      where: { slug: { in: dto.specialties } },
    });
    if (categories.length !== dto.specialties.length) {
      throw new BadRequestException('Uma ou mais áreas de atuação são inválidas.');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { lawyer: true },
    });
    if (existing?.lawyer) {
      throw new ConflictException('Já existe um advogado com este e-mail.');
    }

    const birthDate = dto.birthDate ? new Date(dto.birthDate) : null;

    const lawyer = await this.prisma.$transaction(
      async (tx) => {
        const user = existing
          ? await tx.user.update({
              where: { id: existing.id },
              data: {
                role: 'LAWYER',
                fullName: dto.fullName,
                ...(dto.gender ? { gender: dto.gender } : {}),
                status: dto.status === 'ACTIVE' ? 'ACTIVE' : 'PENDING_VERIFICATION',
              },
            })
          : await tx.user.create({
              data: {
                email: dto.email,
                fullName: dto.fullName,
                gender: dto.gender ?? null,
                role: 'LAWYER',
                status: dto.status === 'ACTIVE' ? 'ACTIVE' : 'PENDING_VERIFICATION',
              },
            });

        const created = await tx.lawyer.create({
          data: {
            userId: user.id,
            status: dto.status,
            createdByAdmin: true,
            provisionalPassword: dto.password,
            oabNumber: dto.oabNumber,
            oabState: dto.oabState.toUpperCase(),
            cpf: dto.cpf,
            phone: dto.phone,
            phone2: dto.phone2 ?? null,
            birthDate: birthDate && !Number.isNaN(birthDate.getTime()) ? birthDate : null,
            city: dto.city ?? null,
            avatarUrl: dto.avatarUrl ? dto.avatarUrl : null,
            residentialAddress: dto.residentialAddress ?? null,
            professionalAddress: dto.professionalAddress ?? null,
          },
        });

        await tx.lawyerSpecialty.createMany({
          data: categories.map((c) => ({ lawyerId: created.id, categoryId: c.id })),
        });
        await tx.kanbanStage.createMany({
          data: [
            { lawyerId: created.id, name: 'Triagem', order: 0 },
            { lawyerId: created.id, name: 'Petição', order: 1 },
            { lawyerId: created.id, name: 'Audiência', order: 2 },
            { lawyerId: created.id, name: 'Concluído', order: 3 },
          ],
        });
        return created;
      },
      { maxWait: 15_000, timeout: 30_000 },
    );

    await this.audit.log({
      actorId: admin.id,
      actorRole: 'ADMIN',
      action: 'ADMIN_CREATE_LAWYER',
      entityType: 'Lawyer',
      entityId: lawyer.id,
      metadata: { email: dto.email, status: dto.status },
    });

    return { lawyerId: lawyer.id, status: lawyer.status, email: dto.email };
  }

  // ---------------- Financeiro ----------------
  async createPlan(admin: User, dto: CreatePlanInput) {
    const exists = await this.prisma.plan.findUnique({ where: { code: dto.code } });
    if (exists) throw new ConflictException('Já existe um plano com este código.');

    const plan = await this.prisma.plan.create({
      data: {
        code: dto.code.toUpperCase(),
        name: dto.name,
        priceBRL: dto.priceBRL,
        casesPerMonth: dto.casesPerMonth,
        areas: dto.areas,
        highlights: dto.highlights,
      },
    });
    await this.audit.log({
      actorId: admin.id,
      actorRole: 'ADMIN',
      action: 'PLAN_CREATE',
      entityType: 'Plan',
      entityId: plan.id,
      metadata: { code: plan.code },
    });
    return { id: plan.id, code: plan.code };
  }

  async finance() {
    const [plans, activeSubs, payments, lawyersActive, lawyersCanceled, byStateRaw] =
      await Promise.all([
        this.prisma.plan.findMany({ where: { active: true } }),
        this.prisma.subscription.findMany({ where: { status: 'ACTIVE' } }),
        this.prisma.payment.findMany({
          orderBy: { createdAt: 'desc' },
          take: 25,
          include: { payerUser: { select: { email: true, fullName: true } } },
        }),
        this.prisma.lawyer.count({ where: { status: 'ACTIVE' } }),
        this.prisma.lawyer.count({ where: { status: 'CANCELED' } }),
        this.prisma.lawyer.groupBy({ by: ['oabState'], _count: { _all: true } }),
      ]);

    const priceByCode = new Map(plans.map((p) => [p.code, Number(p.priceBRL)]));
    const mrr = activeSubs.reduce((sum, s) => sum + (priceByCode.get(s.planCode) ?? 0), 0);

    const byPlan = plans
      .sort((a, b) => Number(a.priceBRL) - Number(b.priceBRL))
      .map((p) => ({
        plan: p.name,
        price: Number(p.priceBRL),
        subscribers: activeSubs.filter((s) => s.planCode === p.code).length,
      }));

    const totalPaid = payments
      .filter((p) => p.status === 'PAID')
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const lawyersByState = byStateRaw
      .map((g) => ({ state: g.oabState, count: g._count._all }))
      .sort((a, b) => b.count - a.count);

    return {
      activeSubscriptions: activeSubs.length,
      lawyersActive,
      lawyersCanceled,
      mrr,
      totalPaid,
      byPlan,
      lawyersByState,
      payments: payments.map((p) => ({
        id: p.id,
        payer: p.payerUser.fullName ?? p.payerUser.email,
        amount: Number(p.amount),
        method: p.method,
        status: p.status,
        paidAt: p.paidAt,
        createdAt: p.createdAt,
      })),
    };
  }

  /** Evolução do número de advogados por mês (novos + acumulado), com filtro de data. */
  async evolution(fromStr?: string, toStr?: string) {
    const now = new Date();
    // Parse local (evita o deslocamento de fuso ao interpretar 'YYYY-MM-DD' como UTC).
    const parseLocal = (s?: string): Date | null => {
      if (!s) return null;
      const [y, m] = s.split('-').map(Number);
      if (!y || !m) return null;
      return new Date(y, m - 1, 1);
    };
    const to = parseLocal(toStr) ?? now;
    const from = parseLocal(fromStr) ?? new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const lawyers = await this.prisma.lawyer.findMany({ select: { createdAt: true } });

    const months: Array<{ month: string; new: number; cumulative: number }> = [];
    let cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    const end = new Date(to.getFullYear(), to.getMonth(), 1);
    let guard = 0;
    while (cursor <= end && guard < 60) {
      const mStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const mEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      months.push({
        month: `${mStart.getFullYear()}-${String(mStart.getMonth() + 1).padStart(2, '0')}`,
        new: lawyers.filter((l) => l.createdAt >= mStart && l.createdAt < mEnd).length,
        cumulative: lawyers.filter((l) => l.createdAt < mEnd).length,
      });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      guard += 1;
    }
    return { from: from.toISOString(), to: to.toISOString(), months };
  }

  /** Planilha de pagamentos: por advogado, status, casos no mês e tempo de atraso. */
  async paymentSheet() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [lawyers, subs, assignments, paidPayments] = await Promise.all([
      this.prisma.lawyer.findMany({ include: { user: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.subscription.findMany({ orderBy: { createdAt: 'desc' } }),
      this.prisma.caseAssignment.groupBy({
        by: ['lawyerId'],
        where: { status: 'ACCEPTED', respondedAt: { gte: monthStart } },
        _count: { _all: true },
      }),
      this.prisma.payment.findMany({
        where: { status: 'PAID' },
        orderBy: { paidAt: 'desc' },
        select: { payerUserId: true, paidAt: true },
      }),
    ]);

    const subByUser = new Map<string, (typeof subs)[number]>();
    for (const s of subs) if (!subByUser.has(s.lawyerUserId)) subByUser.set(s.lawyerUserId, s);
    const casesByLawyer = new Map(assignments.map((a) => [a.lawyerId, a._count._all]));
    const lastPaidByUser = new Map<string, Date>();
    for (const p of paidPayments) if (p.paidAt && !lastPaidByUser.has(p.payerUserId)) lastPaidByUser.set(p.payerUserId, p.paidAt);

    const MS_DAY = 24 * 60 * 60 * 1000;
    const MS_MONTH = 30 * MS_DAY;

    return lawyers.map((l) => {
      const sub = subByUser.get(l.userId);
      let payment: 'EM_DIA' | 'VENCIDO' | 'SEM_PLANO' = 'SEM_PLANO';
      let overdueSince: Date | null = null;
      if (sub) {
        const inPeriod = sub.currentPeriodEnd ? sub.currentPeriodEnd > now : false;
        payment = sub.status === 'ACTIVE' && inPeriod ? 'EM_DIA' : 'VENCIDO';
        if (payment === 'VENCIDO') {
          overdueSince =
            sub.currentPeriodEnd && sub.currentPeriodEnd <= now
              ? sub.currentPeriodEnd
              : (sub.canceledAt ?? null);
        }
      }
      const overdueMs = overdueSince ? Math.max(0, now.getTime() - overdueSince.getTime()) : 0;
      const daysOverdue = overdueSince ? Math.floor(overdueMs / MS_DAY) : 0;
      const monthsOverdue = overdueSince ? Math.floor(overdueMs / MS_MONTH) : 0;

      return {
        lawyerId: l.id,
        name: l.user.fullName,
        email: l.user.email,
        phone: l.phone,
        avatarUrl: l.avatarUrl,
        planCode: sub?.planCode ?? null,
        payment,
        casesThisMonth: casesByLawyer.get(l.id) ?? 0,
        accountStatus: l.status,
        lastPaymentAt: lastPaidByUser.get(l.userId) ?? null,
        overdueSince,
        daysOverdue,
        monthsOverdue,
      };
    });
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
      isOwner: u.isOwner,
      adminScopes: u.adminScopes,
      createdAt: u.createdAt,
    }));
  }

  /** Lista apenas administradores (com escopos) — para a tela de gestão. */
  async listAdmins() {
    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN' },
      orderBy: [{ isOwner: 'desc' }, { createdAt: 'asc' }],
    });
    return admins.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      isOwner: u.isOwner,
      scopes: u.adminScopes,
      provisionalPassword: u.provisionalPassword,
      createdAt: u.createdAt,
    }));
  }

  /** Cria um administrador com login/senha e escopos (somente o dono). */
  async createAdmin(owner: User, dto: CreateAdminInput) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing?.role === 'ADMIN') {
      throw new ConflictException('Este e-mail já é de um administrador.');
    }
    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            role: 'ADMIN',
            fullName: dto.fullName,
            adminScopes: dto.scopes,
            provisionalPassword: dto.password,
            status: 'ACTIVE',
          },
        })
      : await this.prisma.user.create({
          data: {
            email: dto.email,
            fullName: dto.fullName,
            role: 'ADMIN',
            adminScopes: dto.scopes,
            provisionalPassword: dto.password,
            status: 'ACTIVE',
          },
        });
    await this.audit.log({
      actorId: owner.id,
      actorRole: 'ADMIN',
      action: 'ADMIN_CREATE',
      entityType: 'User',
      entityId: user.id,
      metadata: { email: dto.email, scopes: dto.scopes },
    });
    return { userId: user.id, email: dto.email };
  }

  /** Remove o acesso de administrador (somente o dono). */
  async removeAdmin(owner: User, userId: string) {
    if (owner.id === userId) {
      throw new BadRequestException('Você não pode remover a si mesmo.');
    }
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u) throw new NotFoundException('Usuário não encontrado.');
    if (u.isOwner) throw new BadRequestException('Não é possível remover o proprietário.');

    await this.prisma.user.update({
      where: { id: userId },
      data: { role: 'CITIZEN', adminScopes: [], provisionalPassword: null },
    });
    await this.audit.log({
      actorId: owner.id,
      actorRole: 'ADMIN',
      action: 'ADMIN_REMOVE',
      entityType: 'User',
      entityId: userId,
    });
    return { userId, removed: true };
  }

  /** Define os escopos de acesso de um administrador (somente o dono). */
  async setAdminScopes(owner: User, userId: string, scopes: string[]) {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u) throw new NotFoundException('Usuário não encontrado.');
    if (u.isOwner) throw new BadRequestException('O proprietário tem acesso total.');
    if (u.role !== 'ADMIN') throw new BadRequestException('Usuário não é administrador.');

    await this.prisma.user.update({ where: { id: userId }, data: { adminScopes: scopes } });
    await this.audit.log({
      actorId: owner.id,
      actorRole: 'ADMIN',
      action: 'ADMIN_SET_SCOPES',
      entityType: 'User',
      entityId: userId,
      metadata: { scopes },
    });
    return { userId, scopes };
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

    const support = await this.supportMetrics();

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
      support,
    };
  }

  /** Métricas de suporte (abertos/em andamento/resolvidos + tempo médio de 1ª resposta). */
  private async supportMetrics() {
    const [open, inProgress, resolved] = await Promise.all([
      this.prisma.supportTicket.count({ where: { status: 'OPEN' } }),
      this.prisma.supportTicket.count({ where: { status: 'IN_PROGRESS' } }),
      this.prisma.supportTicket.count({ where: { status: 'RESOLVED' } }),
    ]);

    const tickets = await this.prisma.supportTicket.findMany({
      select: {
        createdAt: true,
        messages: {
          where: { authorRole: 'ADMIN' },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { createdAt: true },
        },
      },
    });
    let sum = 0;
    let n = 0;
    for (const t of tickets) {
      const first = t.messages[0];
      if (first) {
        sum += first.createdAt.getTime() - t.createdAt.getTime();
        n += 1;
      }
    }
    const avgResponseMinutes = n > 0 ? Math.round(sum / n / 60000) : null;
    return { open, inProgress, resolved, avgResponseMinutes };
  }

  /** Cadastros de cidadãos (nome, telefone, região, sexo) — advogados têm aba própria. */
  async listPeople() {
    const users = await this.prisma.user.findMany({
      where: { role: 'CITIZEN' },
      orderBy: { createdAt: 'desc' },
    });
    const GENDER: Record<string, string> = { M: 'Masculino', F: 'Feminino', OUTRO: 'Outro' };
    return users.map((u) => ({
      id: u.id,
      name: u.fullName,
      phone: u.phone,
      city: u.city,
      state: u.state,
      gender: u.gender ? (GENDER[u.gender] ?? u.gender) : null,
      createdAt: u.createdAt,
    }));
  }

  /** Ficha de um cidadão + se tem processo aberto com advogado da plataforma. */
  async getPerson(id: string) {
    const u = await this.prisma.user.findFirst({ where: { id, role: 'CITIZEN' } });
    if (!u) throw new NotFoundException('Cidadão não encontrado.');

    const a = await this.prisma.caseAssignment.findFirst({
      where: { status: 'ACCEPTED', case: { citizenId: id } },
      orderBy: { respondedAt: 'desc' },
      include: { lawyer: { include: { user: true } }, case: true },
    });

    const GENDER: Record<string, string> = { M: 'Masculino', F: 'Feminino', OUTRO: 'Outro' };
    return {
      id: u.id,
      name: u.fullName,
      email: u.email,
      phone: u.phone,
      city: u.city,
      state: u.state,
      gender: u.gender ? (GENDER[u.gender] ?? u.gender) : null,
      createdAt: u.createdAt,
      process: a
        ? {
            protocol: a.case.protocol,
            caseStatus: a.case.status,
            lawyerName: a.lawyer.user.fullName,
            lawyerOab: `${a.lawyer.oabNumber}/${a.lawyer.oabState}`,
          }
        : null,
    };
  }

  /** Contadores para os badges de notificação do menu admin. */
  async notifications() {
    const [supportOpen, lawyersPending] = await Promise.all([
      this.prisma.supportTicket.count({ where: { status: 'OPEN' } }),
      this.prisma.lawyer.count({ where: { status: 'IN_ANALYSIS' } }),
    ]);
    return { supportOpen, lawyersPending };
  }
}
