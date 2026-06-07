import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { assistLawyerEditor } from '@app/ai-core';
import type { GeneratedDocument, Lawyer, User } from '@app/db';
import type { CreatePecaInput, PecaAiInput, UpdatePecaInput } from '@app/validation';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { LawyerContextService } from '../../common/lawyer/lawyer-context.service';
import { StorageService } from '../../common/storage/storage.service';

@Injectable()
export class PecasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly lawyerCtx: LawyerContextService,
    private readonly storage: StorageService,
  ) {}

  async list(user: User, caseId: string) {
    await this.assertAssigned(user, caseId);
    const docs = await this.prisma.generatedDocument.findMany({
      where: { caseId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    });
    return docs.map((d) => this.toView(d));
  }

  async get(user: User, id: string) {
    const doc = await this.loadOwned(user, id);
    return this.toView(doc);
  }

  async create(user: User, dto: CreatePecaInput) {
    const lawyer = await this.assertAssigned(user, dto.caseId);
    const doc = await this.prisma.generatedDocument.create({
      data: {
        caseId: dto.caseId,
        authoredByLawyerId: lawyer.id,
        type: dto.type,
        title: dto.title,
        content: dto.content,
        isAiAssisted: false,
      },
    });
    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'PECA_CREATE',
      entityType: 'GeneratedDocument',
      entityId: doc.id,
      metadata: { caseId: dto.caseId },
    });
    return this.toView(doc);
  }

  async update(user: User, id: string, dto: UpdatePecaInput) {
    const doc = await this.loadOwned(user, id);
    const updated = await this.prisma.generatedDocument.update({
      where: { id: doc.id },
      data: {
        title: dto.title ?? doc.title,
        content: dto.content,
        version: { increment: 1 },
      },
    });
    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'PECA_UPDATE',
      entityType: 'GeneratedDocument',
      entityId: doc.id,
      metadata: { version: updated.version },
    });
    return this.toView(updated);
  }

  /** Chat contextual de IA dentro do editor (Módulo A+C). */
  async aiAssist(user: User, dto: PecaAiInput) {
    await this.assertAssigned(user, dto.caseId);

    const caseRecord = await this.prisma.case.findUnique({ where: { id: dto.caseId } });

    // registra a instrução do advogado (contexto do editor)
    await this.prisma.aiMessage.create({
      data: {
        caseId: dto.caseId,
        userId: user.id,
        role: 'USER',
        content: dto.instruction,
        context: 'LAWYER_EDITOR',
      },
    });

    const result = await assistLawyerEditor({
      instruction: dto.instruction,
      currentContent: dto.currentContent,
      caseSummary: caseRecord?.aiSummary ?? undefined,
    });

    await this.prisma.aiMessage.create({
      data: {
        caseId: dto.caseId,
        role: 'ASSISTANT',
        content: result.text,
        context: 'LAWYER_EDITOR',
        provider: result.provider,
        model: result.model,
        piiRedacted: result.piiRedacted,
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'PECA_AI_ASSIST',
      entityType: 'Case',
      entityId: dto.caseId,
      metadata: { provider: result.provider },
    });

    return { suggestion: result.text };
  }

  /** Documentos do caso para o advogado atribuído (somente leitura). */
  async caseDocuments(user: User, caseId: string) {
    await this.assertAssigned(user, caseId);
    const docs = await this.prisma.document.findMany({
      where: { caseId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(
      docs.map(async (d) => ({
        id: d.id,
        fileName: d.fileName,
        mimeType: d.mimeType,
        sizeBytes: d.sizeBytes,
        downloadUrl: await this.storage.createDownloadUrl(d.storageKey),
      })),
    );
  }

  // ---------------- helpers ----------------
  private async assertAssigned(user: User, caseId: string): Promise<Lawyer> {
    const lawyer = await this.lawyerCtx.resolveVerified(user);
    const assignment = await this.prisma.caseAssignment.findFirst({
      where: { caseId, lawyerId: lawyer.id, status: 'ACCEPTED' },
    });
    if (!assignment) {
      throw new ForbiddenException('Caso não atribuído a você.');
    }
    return lawyer;
  }

  private async loadOwned(user: User, id: string): Promise<GeneratedDocument> {
    const doc = await this.prisma.generatedDocument.findFirst({
      where: { id, deletedAt: null },
    });
    if (!doc) throw new NotFoundException('Peça não encontrada.');
    await this.assertAssigned(user, doc.caseId);
    return doc;
  }

  private toView(d: GeneratedDocument) {
    return {
      id: d.id,
      caseId: d.caseId,
      type: d.type,
      title: d.title,
      content: d.content,
      version: d.version,
      isAiAssisted: d.isAiAssisted,
      updatedAt: d.updatedAt,
    };
  }
}
