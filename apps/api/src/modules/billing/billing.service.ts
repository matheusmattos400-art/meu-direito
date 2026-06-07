import { BadRequestException, Injectable } from '@nestjs/common';
import type { User } from '@app/db';
import type { SubscribeComboInput } from '@app/validation';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

const PERIOD_DAYS = 30;

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Catálogo: áreas ofertadas (com preço) + planos combo (com áreas). */
  async catalog() {
    const [cats, plans] = await Promise.all([
      this.prisma.category.findMany({
        where: { active: true, billable: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.plan.findMany({
        where: { active: true },
        orderBy: { priceBRL: 'asc' },
        include: { planAreas: { include: { category: true } } },
      }),
    ]);
    return {
      areas: cats.map((c) => ({ id: c.id, name: c.name, priceBRL: Number(c.monthlyPriceBRL ?? 0) })),
      plans: plans.map((p) => ({
        code: p.code,
        name: p.name,
        priceBRL: Number(p.priceBRL),
        highlights: p.highlights,
        areas: p.planAreas.map((pa) => ({ id: pa.categoryId, name: pa.category.name })),
      })),
    };
  }

  async currentSubscription(user: User) {
    const sub = await this.prisma.subscription.findFirst({
      where: { lawyerUserId: user.id },
      orderBy: { createdAt: 'desc' },
      include: { areas: { include: { category: true } } },
    });
    if (!sub) return null;
    const plan = sub.planCode
      ? await this.prisma.plan.findUnique({ where: { code: sub.planCode } })
      : null;
    return {
      id: sub.id,
      planCode: sub.planCode,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd, // data de renovação
      monthlyTotalBRL: sub.monthlyTotalBRL != null ? Number(sub.monthlyTotalBRL) : null,
      areas: sub.areas.map((a) => ({
        id: a.categoryId,
        name: a.category.name,
        priceBRL: Number(a.priceBRL),
      })),
      plan: plan
        ? { code: plan.code, name: plan.name, priceBRL: Number(plan.priceBRL) }
        : null,
    };
  }

  /**
   * Assina/atualiza o combo do advogado: um plano combo (planCode) OU áreas
   * montadas por ele (areaIds). Migrar/cancelar área = reenviar com o novo
   * conjunto: o acesso muda na hora e a data de renovação é mantida. Gateway
   * simulado (mock) — a integração real (Stripe / PIX-boleto) entra aqui.
   */
  async subscribe(user: User, dto: SubscribeComboInput) {
    let planCode: string | null = null;
    let areaIds: string[] = [];
    let total = 0;

    if (dto.planCode) {
      const plan = await this.prisma.plan.findUnique({
        where: { code: dto.planCode },
        include: { planAreas: true },
      });
      if (!plan || !plan.active) throw new BadRequestException('Plano inválido.');
      planCode = plan.code;
      areaIds = plan.planAreas.map((pa) => pa.categoryId);
      total = Number(plan.priceBRL);
    } else {
      const cats = await this.prisma.category.findMany({
        where: { id: { in: dto.areaIds ?? [] }, billable: true, active: true },
      });
      if (cats.length === 0) throw new BadRequestException('Selecione ao menos uma área válida.');
      areaIds = cats.map((c) => c.id);
      total = cats.reduce((t, c) => t + Number(c.monthlyPriceBRL ?? 0), 0);
    }

    // preço por área para o snapshot
    const cats = await this.prisma.category.findMany({ where: { id: { in: areaIds } } });
    const priceByCat = new Map(cats.map((c) => [c.id, Number(c.monthlyPriceBRL ?? 0)]));

    const now = new Date();
    const existing = await this.prisma.subscription.findFirst({
      where: { lawyerUserId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    // Mantém a renovação só se o ciclo ativo ainda está vigente (migrar áreas no
    // meio do mês). Assinatura nova, reativação ou ciclo vencido → renova agora.
    const keepPeriod =
      existing?.status === 'ACTIVE' && !!existing.currentPeriodEnd && existing.currentPeriodEnd > now;
    const periodStart = keepPeriod ? existing!.currentPeriodStart! : now;
    const periodEnd = keepPeriod
      ? existing!.currentPeriodEnd!
      : new Date(now.getTime() + PERIOD_DAYS * 24 * 60 * 60 * 1000);

    const subscription = existing
      ? await this.prisma.subscription.update({
          where: { id: existing.id },
          data: {
            planCode,
            status: 'ACTIVE',
            monthlyTotalBRL: total,
            gateway: 'mock',
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            canceledAt: null,
          },
        })
      : await this.prisma.subscription.create({
          data: {
            lawyerUserId: user.id,
            planCode,
            status: 'ACTIVE',
            monthlyTotalBRL: total,
            gateway: 'mock',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
        });

    // substitui as áreas da assinatura (snapshot de preço)
    await this.prisma.subscriptionArea.deleteMany({ where: { subscriptionId: subscription.id } });
    await this.prisma.subscriptionArea.createMany({
      data: areaIds.map((id) => ({
        subscriptionId: subscription.id,
        categoryId: id,
        priceBRL: priceByCat.get(id) ?? 0,
      })),
    });

    // áreas pagas = áreas de atuação (recebe casos só dessas áreas)
    const lawyer = await this.prisma.lawyer.findUnique({ where: { userId: user.id } });
    if (lawyer) {
      await this.prisma.lawyerSpecialty.deleteMany({ where: { lawyerId: lawyer.id } });
      await this.prisma.lawyerSpecialty.createMany({
        data: areaIds.map((id) => ({ lawyerId: lawyer.id, categoryId: id })),
        skipDuplicates: true,
      });
    }

    // cobrança simulada quando inicia um novo ciclo (não a cada troca de área no mês)
    if (!keepPeriod) {
      await this.prisma.payment.create({
        data: {
          subscriptionId: subscription.id,
          payerUserId: user.id,
          amount: total,
          currency: 'BRL',
          method: dto.method,
          status: 'PAID',
          gateway: 'mock',
          paidAt: now,
        },
      });
    }

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'SUBSCRIBE',
      entityType: 'Subscription',
      entityId: subscription.id,
      metadata: { planCode, areas: areaIds.length, total, method: dto.method },
    });

    return this.currentSubscription(user);
  }

  async cancel(user: User) {
    const existing = await this.prisma.subscription.findFirst({
      where: { lawyerUserId: user.id, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
    if (!existing) throw new BadRequestException('Nenhuma assinatura ativa.');

    await this.prisma.subscription.update({
      where: { id: existing.id },
      data: { status: 'CANCELED', canceledAt: new Date() },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'SUBSCRIPTION_CANCEL',
      entityType: 'Subscription',
      entityId: existing.id,
    });

    return { id: existing.id, status: 'CANCELED' };
  }
}
