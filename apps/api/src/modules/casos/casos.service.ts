import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  analyzeTriage,
  generateTriageReply,
  type TriageMessage,
  type TriageReplyResult,
} from '@app/ai-core';
import type { Case, User } from '@app/db';
import type { SendTriageMessageInput, StartTriageInput } from '@app/validation';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { RagService } from '../knowledge/rag.service';

@Injectable()
export class CasosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly rag: RagService,
  ) {}

  // ---------------- Cidadão: iniciar triagem ----------------
  async startTriage(user: User, dto: StartTriageInput) {
    const caseRecord = await this.prisma.case.create({
      data: {
        protocol: this.generateProtocol(),
        citizenId: user.id,
        rawNarrative: dto.narrative,
        city: dto.city ?? null,
        state: dto.state ? dto.state.toUpperCase() : null,
        status: 'TRIAGING',
      },
    });

    await this.prisma.aiMessage.create({
      data: {
        caseId: caseRecord.id,
        userId: user.id,
        role: 'USER',
        content: dto.narrative,
        context: 'CITIZEN_TRIAGE',
      },
    });

    const legalContext = await this.rag.buildContext(dto.narrative);
    const reply = await generateTriageReply({
      history: [],
      userMessage: dto.narrative,
      legalContext,
    });
    const assistant = await this.persistAssistant(caseRecord.id, reply);

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'CASE_CREATE',
      entityType: 'Case',
      entityId: caseRecord.id,
    });

    return {
      case: this.toSummary(caseRecord),
      reply: reply.reply,
      messageId: assistant.id,
    };
  }

  // ---------------- Cidadão: enviar mensagem ----------------
  async sendMessage(user: User, caseId: string, dto: SendTriageMessageInput) {
    const caseRecord = await this.getOwnedCase(user, caseId);
    const history = await this.loadHistory(caseId);

    await this.prisma.aiMessage.create({
      data: {
        caseId,
        userId: user.id,
        role: 'USER',
        content: dto.content,
        context: 'CITIZEN_TRIAGE',
      },
    });

    const legalContext = await this.rag.buildContext(dto.content);
    const reply = await generateTriageReply({
      history,
      userMessage: dto.content,
      sensitive: caseRecord.sensitivity === 'SENSITIVE',
      legalContext,
    });
    const assistant = await this.persistAssistant(caseId, reply);

    return {
      reply: reply.reply,
      messageId: assistant.id,
      flaggedInjection: reply.flaggedInjection,
    };
  }

  // ---------------- Análise estruturada (classificação) ----------------
  async analyze(user: User, caseId: string) {
    await this.getOwnedCase(user, caseId);
    const history = await this.loadHistory(caseId);

    const categories = await this.prisma.category.findMany({
      where: { active: true },
      include: { subcategories: { where: { active: true } } },
    });

    const legalContext = await this.rag.buildContext(
      history.map((m) => m.content).join('\n'),
    );
    const analysis = await analyzeTriage({
      history,
      legalContext,
      categories: categories.map((c) => ({
        slug: c.slug,
        name: c.name,
        subcategories: c.subcategories.map((s) => ({ slug: s.slug, name: s.name })),
      })),
    });

    const category = analysis.categorySlug
      ? categories.find((c) => c.slug === analysis.categorySlug)
      : undefined;
    const subcategory =
      category && analysis.subcategorySlug
        ? category.subcategories.find((s) => s.slug === analysis.subcategorySlug)
        : undefined;

    const updated = await this.prisma.case.update({
      where: { id: caseId },
      data: {
        categoryId: category?.id ?? null,
        subcategoryId: subcategory?.id ?? null,
        potential: analysis.potential,
        sensitivity: analysis.sensitive ? 'SENSITIVE' : 'NORMAL',
        aiSummary: analysis.summary,
        aiRisks: analysis.risks,
        missingDocs: analysis.missingDocuments,
        nextSteps: analysis.nextSteps,
        adminPaths: analysis.administrativePaths,
        aiConfidence: analysis.confidence,
        // Dúvida simples resolve-se com a orientação; potencial adm/judicial
        // qualifica o caso para virar oportunidade de atendimento.
        status: analysis.potential === 'DOUBT' ? 'RESOLVED_INFO' : 'QUALIFIED',
        triagedAt: new Date(),
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'CASE_TRIAGE_ANALYZE',
      entityType: 'Case',
      entityId: caseId,
      metadata: { potential: analysis.potential, provider: analysis.provider },
    });

    return { case: this.toDetail(updated), analysis };
  }

  // ---------------- Listagem / detalhe ----------------
  async listMyCases(user: User) {
    const cases = await this.prisma.case.findMany({
      where: { citizenId: user.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return cases.map((c) => this.toSummary(c));
  }

  async getCaseDetail(user: User, caseId: string) {
    const caseRecord = await this.getOwnedCase(user, caseId);
    const messages = await this.prisma.aiMessage.findMany({
      where: { caseId },
      orderBy: { createdAt: 'asc' },
    });
    return {
      ...this.toDetail(caseRecord),
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
    };
  }

  // ---------------- helpers ----------------
  private async getOwnedCase(user: User, caseId: string): Promise<Case> {
    const caseRecord = await this.prisma.case.findFirst({
      where: { id: caseId, citizenId: user.id, deletedAt: null },
    });
    if (!caseRecord) {
      // NotFound (não Forbidden) para não revelar a existência do recurso.
      throw new NotFoundException('Caso não encontrado.');
    }
    return caseRecord;
  }

  private async loadHistory(caseId: string): Promise<TriageMessage[]> {
    const messages = await this.prisma.aiMessage.findMany({
      where: { caseId, role: { in: ['USER', 'ASSISTANT'] } },
      orderBy: { createdAt: 'asc' },
    });
    return messages.map((m) => ({
      role: m.role === 'ASSISTANT' ? 'assistant' : 'user',
      content: m.content,
    }));
  }

  private async persistAssistant(caseId: string, reply: TriageReplyResult) {
    return this.prisma.aiMessage.create({
      data: {
        caseId,
        role: 'ASSISTANT',
        content: reply.reply,
        context: 'CITIZEN_TRIAGE',
        provider: reply.provider,
        model: reply.model,
        promptTokens: reply.usage?.promptTokens ?? null,
        completionTokens: reply.usage?.completionTokens ?? null,
        piiRedacted: reply.piiRedacted,
      },
    });
  }

  private generateProtocol(): string {
    return `MD-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private toSummary(c: Case) {
    return {
      id: c.id,
      protocol: c.protocol,
      status: c.status,
      potential: c.potential,
      sensitivity: c.sensitivity,
      title: c.title,
      createdAt: c.createdAt,
    };
  }

  private toDetail(c: Case) {
    return {
      ...this.toSummary(c),
      categoryId: c.categoryId,
      subcategoryId: c.subcategoryId,
      summary: c.aiSummary,
      risks: c.aiRisks,
      missingDocuments: c.missingDocs,
      nextSteps: c.nextSteps,
      administrativePaths: c.adminPaths,
      confidence: c.aiConfidence,
      triagedAt: c.triagedAt,
    };
  }
}
