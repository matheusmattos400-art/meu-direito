import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { SupportStatus, User, UserRole } from '@app/db';
import type { OpenTicketInput, TicketMessageInput } from '@app/validation';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { StorageService } from '../../common/storage/storage.service';

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  // ---------------- Usuário (cidadão / advogado) ----------------
  async open(user: User, dto: OpenTicketInput) {
    const ticket = await this.prisma.supportTicket.create({
      data: {
        requesterId: user.id,
        requesterRole: user.role,
        subject: dto.subject,
        messages: { create: { authorId: user.id, authorRole: user.role, body: dto.message } },
      },
    });
    return { id: ticket.id, status: ticket.status };
  }

  async myTickets(user: User) {
    const tickets = await this.prisma.supportTicket.findMany({
      where: { requesterId: user.id },
      orderBy: [{ status: 'asc' }, { lastMessageAt: 'desc' }],
    });
    return tickets.map((t) => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      lastMessageAt: t.lastMessageAt,
    }));
  }

  async myTicket(user: User, id: string) {
    const t = await this.prisma.supportTicket.findFirst({
      where: { id, requesterId: user.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!t) throw new NotFoundException('Chamado não encontrado.');
    return this.toThread(t);
  }

  /** Responde a um chamado (texto e/ou anexo). asAdmin permite responder qualquer um. */
  async reply(user: User, id: string, dto: TicketMessageInput, asAdmin: boolean) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: asAdmin ? { id } : { id, requesterId: user.id },
    });
    if (!ticket) throw new NotFoundException('Chamado não encontrado.');

    const message = await this.prisma.supportMessage.create({
      data: {
        ticketId: id,
        authorId: user.id,
        authorRole: user.role,
        body: dto.body ?? '',
        attachmentKey: dto.attachmentKey ?? null,
        attachmentName: dto.attachmentName ?? null,
        attachmentMime: dto.attachmentMime ?? null,
      },
    });

    await this.prisma.supportTicket.update({
      where: { id },
      data: {
        lastMessageAt: new Date(),
        ...(asAdmin && ticket.status === 'OPEN'
          ? { status: 'IN_PROGRESS', assignedAdminId: user.id }
          : {}),
      },
    });
    return { id: message.id };
  }

  /** URL assinada para anexar arquivo no chat. */
  async attachmentUploadUrl(
    user: User,
    ticketId: string,
    fileName: string,
    _mime: string,
    asAdmin: boolean,
  ) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: asAdmin ? { id: ticketId } : { id: ticketId, requesterId: user.id },
    });
    if (!ticket) throw new NotFoundException('Chamado não encontrado.');
    const safe = fileName.replace(/[^\w.\-]/g, '_');
    return this.storage.createUploadUrl(`support/${ticketId}/${randomUUID()}-${safe}`);
  }

  // ---------------- Admin (helpdesk) ----------------
  async adminList(status?: string, requesterRole?: string) {
    const tickets = await this.prisma.supportTicket.findMany({
      where: {
        ...(status ? { status: status as SupportStatus } : {}),
        ...(requesterRole ? { requesterRole: requesterRole as UserRole } : {}),
      },
      include: {
        requester: { select: { fullName: true, email: true } },
        _count: { select: { messages: true } },
      },
      orderBy: [{ status: 'asc' }, { lastMessageAt: 'desc' }],
    });
    return tickets.map((t) => ({
      id: t.id,
      subject: t.subject,
      requesterName: t.requester.fullName ?? t.requester.email,
      requesterRole: t.requesterRole,
      status: t.status,
      messages: t._count.messages,
      lastMessageAt: t.lastMessageAt,
    }));
  }

  async adminTicket(id: string) {
    const t = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        requester: { select: { id: true, fullName: true, email: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!t) throw new NotFoundException('Chamado não encontrado.');
    const thread = await this.toThread(
      t,
      t.requester.fullName ?? t.requester.email,
      t.requester.id,
    );
    return { ...thread, currentLawyer: await this.currentLawyerFor(t.requester.id) };
  }

  async setStatus(admin: User, id: string, status: SupportStatus) {
    const t = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Chamado não encontrado.');
    await this.prisma.supportTicket.update({
      where: { id },
      data: { status, assignedAdminId: admin.id },
    });
    await this.audit.log({
      actorId: admin.id,
      actorRole: 'ADMIN',
      action: 'SUPPORT_SET_STATUS',
      entityType: 'SupportTicket',
      entityId: id,
      metadata: { status },
    });
    return { id, status };
  }

  // ---------------- Advogado do cliente (operado pelo admin) ----------------
  /** Lista advogados ATIVOS, opcionalmente filtrando por estado (região). */
  async listActiveLawyers(state?: string) {
    const lawyers = await this.prisma.lawyer.findMany({
      where: { status: 'ACTIVE', ...(state ? { oabState: state.toUpperCase() } : {}) },
      include: { user: true, specialties: { include: { category: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return lawyers.map((l) => ({
      lawyerId: l.id,
      name: l.user.fullName,
      oab: `${l.oabNumber}/${l.oabState}`,
      state: l.oabState,
      city: l.city,
      specialties: l.specialties.map((s) => s.category.name),
    }));
  }

  /** Atribui (ou substitui) o advogado do cliente do chamado. */
  async assignLawyer(admin: User, ticketId: string, lawyerId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Chamado não encontrado.');

    const lawyer = await this.prisma.lawyer.findUnique({ where: { id: lawyerId } });
    if (!lawyer) throw new BadRequestException('Advogado inválido.');
    if (lawyer.status !== 'ACTIVE') throw new BadRequestException('O advogado não está ativo.');

    // substituição: encerra o vínculo ativo anterior do cliente
    await this.withdrawActive(ticket.requesterId);

    const firstStage = await this.prisma.kanbanStage.findFirst({
      where: { lawyerId },
      orderBy: { order: 'asc' },
    });
    const caseRec = await this.prisma.case.create({
      data: {
        protocol: `MD-${randomUUID().slice(0, 8).toUpperCase()}`,
        citizenId: ticket.requesterId,
        status: 'ASSIGNED',
        title: `Atendimento — ${ticket.subject}`.slice(0, 180),
      },
    });
    await this.prisma.caseAssignment.create({
      data: {
        caseId: caseRec.id,
        lawyerId,
        status: 'ACCEPTED',
        respondedAt: new Date(),
        kanbanStageId: firstStage?.id ?? null,
      },
    });

    await this.audit.log({
      actorId: admin.id,
      actorRole: 'ADMIN',
      action: 'ADMIN_ASSIGN_LAWYER',
      entityType: 'SupportTicket',
      entityId: ticketId,
      metadata: { lawyerId, citizenId: ticket.requesterId },
    });
    return this.currentLawyerFor(ticket.requesterId);
  }

  /** Cancela o acesso do cliente com o advogado atual. */
  async cancelLawyer(admin: User, ticketId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Chamado não encontrado.');
    await this.withdrawActive(ticket.requesterId);
    await this.audit.log({
      actorId: admin.id,
      actorRole: 'ADMIN',
      action: 'ADMIN_CANCEL_LAWYER',
      entityType: 'SupportTicket',
      entityId: ticketId,
      metadata: { citizenId: ticket.requesterId },
    });
    return { cleared: true };
  }

  /** Libera acesso de um advogado por N dias (ex.: perdeu acesso por bug, mesmo pagando). */
  async grantAccess(admin: User, ticketId: string, days: number) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Chamado não encontrado.');
    const lawyer = await this.prisma.lawyer.findUnique({ where: { userId: ticket.requesterId } });
    if (!lawyer) throw new BadRequestException('Este chamado não é de um advogado.');

    const now = new Date();
    const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    await this.prisma.lawyer.update({ where: { id: lawyer.id }, data: { status: 'ACTIVE' } });
    await this.prisma.user.update({ where: { id: ticket.requesterId }, data: { status: 'ACTIVE' } });

    const sub = await this.prisma.subscription.findFirst({
      where: { lawyerUserId: ticket.requesterId },
      orderBy: { createdAt: 'desc' },
    });
    if (sub) {
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'ACTIVE', currentPeriodStart: now, currentPeriodEnd: until, gateway: 'manual', canceledAt: null },
      });
    } else {
      await this.prisma.subscription.create({
        data: {
          lawyerUserId: ticket.requesterId,
          planCode: 'STARTER',
          status: 'ACTIVE',
          gateway: 'manual',
          currentPeriodStart: now,
          currentPeriodEnd: until,
        },
      });
    }

    await this.audit.log({
      actorId: admin.id,
      actorRole: 'ADMIN',
      action: 'ADMIN_GRANT_ACCESS',
      entityType: 'Lawyer',
      entityId: lawyer.id,
      metadata: { days, until: until.toISOString() },
    });
    return { until, days };
  }

  private async withdrawActive(citizenId: string) {
    const active = await this.prisma.caseAssignment.findMany({
      where: { status: 'ACCEPTED', case: { citizenId } },
    });
    for (const a of active) {
      await this.prisma.caseAssignment.update({ where: { id: a.id }, data: { status: 'WITHDRAWN' } });
      await this.prisma.case.update({ where: { id: a.caseId }, data: { status: 'ARCHIVED' } });
    }
  }

  private async currentLawyerFor(citizenId: string) {
    const a = await this.prisma.caseAssignment.findFirst({
      where: { status: 'ACCEPTED', case: { citizenId } },
      orderBy: { respondedAt: 'desc' },
      include: { lawyer: { include: { user: true } } },
    });
    if (!a) return null;
    return {
      lawyerId: a.lawyerId,
      name: a.lawyer.user.fullName,
      oab: `${a.lawyer.oabNumber}/${a.lawyer.oabState}`,
      state: a.lawyer.oabState,
      city: a.lawyer.city,
    };
  }

  // ---------------- helper ----------------
  private async toThread(
    t: {
      id: string;
      subject: string;
      status: SupportStatus;
      requesterRole: UserRole;
      messages: Array<{
        id: string;
        body: string;
        authorRole: UserRole;
        createdAt: Date;
        attachmentKey: string | null;
        attachmentName: string | null;
      }>;
    },
    requesterName?: string | null,
    requesterId?: string | null,
  ) {
    const messages = await Promise.all(
      t.messages.map(async (m) => ({
        id: m.id,
        body: m.body,
        authorRole: m.authorRole,
        fromAdmin: m.authorRole === 'ADMIN',
        createdAt: m.createdAt,
        attachment: m.attachmentKey
          ? { name: m.attachmentName, url: await this.storage.createDownloadUrl(m.attachmentKey) }
          : null,
      })),
    );
    return {
      id: t.id,
      subject: t.subject,
      status: t.status,
      requesterRole: t.requesterRole,
      requesterName: requesterName ?? null,
      requesterId: requesterId ?? null,
      messages,
    };
  }
}
