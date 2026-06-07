import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Case, User } from '@app/db';
import type { DocumentUploadUrlInput, RegisterDocumentInput } from '@app/validation';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { StorageService } from '../../common/storage/storage.service';
import { ConsentService } from '../consent/consent.service';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly consent: ConsentService,
  ) {}

  /** Emite URL assinada de upload — exige consentimento de upload (LGPD). */
  async createUploadUrl(user: User, dto: DocumentUploadUrlInput, meta: { ip?: string }) {
    await this.getOwnedCase(user, dto.caseId);

    const granted = await this.consent.hasGranted(user.id, 'DOCUMENT_UPLOAD');
    if (!granted) {
      throw new ForbiddenException({
        message: 'É necessário aceitar o termo de envio de documentos antes do upload.',
        code: 'CONSENT_REQUIRED',
      });
    }

    const safeName = dto.fileName.replace(/[^\w.\-]/g, '_');
    const path = `${dto.caseId}/${randomUUID()}-${safeName}`;
    const signed = await this.storage.createUploadUrl(path);

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'DOC_UPLOAD_URL',
      entityType: 'Case',
      entityId: dto.caseId,
      ipAddress: meta.ip,
      metadata: { fileName: dto.fileName },
    });

    return signed;
  }

  /** Registra os metadados após o upload direto ao Storage. */
  async register(user: User, dto: RegisterDocumentInput, meta: { ip?: string }) {
    await this.getOwnedCase(user, dto.caseId);

    const doc = await this.prisma.document.create({
      data: {
        caseId: dto.caseId,
        uploadedById: user.id,
        storageBucket: this.storage.bucket(),
        storageKey: dto.storageKey,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        checksum: dto.checksum ?? null,
        isEncrypted: true,
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'UPLOAD_DOC',
      entityType: 'Document',
      entityId: doc.id,
      ipAddress: meta.ip,
      metadata: { caseId: dto.caseId, fileName: dto.fileName },
    });

    return { id: doc.id, fileName: doc.fileName, createdAt: doc.createdAt };
  }

  /** Lista documentos de um caso com URLs de download de curta duração. */
  async list(user: User, caseId: string) {
    await this.getOwnedCase(user, caseId);
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
        createdAt: d.createdAt,
        downloadUrl: await this.storage.createDownloadUrl(d.storageKey),
      })),
    );
  }

  /** Exclusão lógica (LGPD) + remoção do arquivo no Storage. */
  async remove(user: User, documentId: string, meta: { ip?: string }) {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, uploadedById: user.id, deletedAt: null },
    });
    if (!doc) throw new NotFoundException('Documento não encontrado.');

    await this.prisma.document.update({
      where: { id: documentId },
      data: { deletedAt: new Date() },
    });

    // Remoção física no Storage (best-effort; a auditoria registra a ação).
    try {
      await this.storage.remove([doc.storageKey]);
    } catch {
      /* mantém a exclusão lógica mesmo se a remoção física falhar */
    }

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'DELETE_DOC',
      entityType: 'Document',
      entityId: documentId,
      ipAddress: meta.ip,
    });

    return { id: documentId, deleted: true };
  }

  private async getOwnedCase(user: User, caseId: string): Promise<Case> {
    const caseRecord = await this.prisma.case.findFirst({
      where: { id: caseId, citizenId: user.id, deletedAt: null },
    });
    if (!caseRecord) throw new NotFoundException('Caso não encontrado.');
    return caseRecord;
  }
}
