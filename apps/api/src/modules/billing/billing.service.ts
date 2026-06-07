import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, type User } from '@app/db';
import type { SubscribeInput } from '@app/validation';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { findPlan, PLANS } from './plans';

const PERIOD_DAYS = 30;

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listPlans() {
    return PLANS;
  }

  async currentSubscription(user: User) {
    const sub = await this.prisma.subscription.findFirst({
      where: { lawyerUserId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    if (!sub) return null;
    return {
      id: sub.id,
      planCode: sub.planCode,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
      plan: findPlan(sub.planCode) ?? null,
    };
  }

  /**
   * Assina/atualiza um plano. Gateway simulado (mock): a assinatura fica ACTIVE
   * e registra um Payment PAID. A integração real (Stripe / gateway PIX/boleto)
   * substitui este trecho mantendo o mesmo contrato.
   */
  async subscribe(user: User, dto: SubscribeInput) {
    const plan = findPlan(dto.planCode);
    if (!plan) throw new BadRequestException('Plano inválido.');

    const now = new Date();
    const periodEnd = new Date(now.getTime() + PERIOD_DAYS * 24 * 60 * 60 * 1000);

    const existing = await this.prisma.subscription.findFirst({
      where: { lawyerUserId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    const subscription = existing
      ? await this.prisma.subscription.update({
          where: { id: existing.id },
          data: {
            planCode: plan.code,
            status: 'ACTIVE',
            gateway: 'mock',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            canceledAt: null,
          },
        })
      : await this.prisma.subscription.create({
          data: {
            lawyerUserId: user.id,
            planCode: plan.code,
            status: 'ACTIVE',
            gateway: 'mock',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
        });

    await this.prisma.payment.create({
      data: {
        subscriptionId: subscription.id,
        payerUserId: user.id,
        amount: new Prisma.Decimal(plan.priceBRL),
        currency: 'BRL',
        method: dto.method,
        status: 'PAID',
        gateway: 'mock',
        paidAt: now,
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'SUBSCRIBE',
      entityType: 'Subscription',
      entityId: subscription.id,
      metadata: { planCode: plan.code, method: dto.method },
    });

    return { id: subscription.id, planCode: subscription.planCode, status: subscription.status };
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
