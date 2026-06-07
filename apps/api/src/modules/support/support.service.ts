import { Injectable, NotFoundException } from '@nestjs/common';
import type { SupportStatus, User, UserRole } from '@app/db';
import type { OpenTicketInput } from '@app/validation';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
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

  /** Responde a um chamado. asAdmin=true permite responder qualquer chamado. */
  async reply(user: User, id: string, body: string, asAdmin: boolean) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: asAdmin ? { id } : { id, requesterId: user.id },
    });
    if (!ticket) throw new NotFoundException('Chamado não encontrado.');

    const message = await this.prisma.supportMessage.create({
      data: { ticketId: id, authorId: user.id, authorRole: user.role, body },
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

  // ---------------- Admin (backoffice / helpdesk) ----------------
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
      // Não resolvidos no topo (OPEN, IN_PROGRESS antes de RESOLVED), depois recência.
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
        requester: { select: { fullName: true, email: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!t) throw new NotFoundException('Chamado não encontrado.');
    return this.toThread(t, t.requester.fullName ?? t.requester.email);
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

  // ---------------- helper ----------------
  private toThread(
    t: {
      id: string;
      subject: string;
      status: SupportStatus;
      requesterRole: UserRole;
      messages: Array<{ id: string; body: string; authorRole: UserRole; createdAt: Date }>;
    },
    requesterName?: string | null,
  ) {
    return {
      id: t.id,
      subject: t.subject,
      status: t.status,
      requesterRole: t.requesterRole,
      requesterName: requesterName ?? null,
      messages: t.messages.map((m) => ({
        id: m.id,
        body: m.body,
        authorRole: m.authorRole,
        fromAdmin: m.authorRole === 'ADMIN',
        createdAt: m.createdAt,
      })),
    };
  }
}
