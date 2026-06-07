import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import type { User } from '@app/db';
import type {
  LawyerRegistrationInput,
  RegisterVerificationDocInput,
  VerificationUploadUrlInput,
} from '@app/validation';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { LawyerContextService } from '../../common/lawyer/lawyer-context.service';
import { StorageService } from '../../common/storage/storage.service';

export interface UserProfile {
  id: string;
  role: User['role'];
  status: User['status'];
  email: string | null;
  fullName: string | null;
}

@Injectable()
export class IdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly lawyerCtx: LawyerContextService,
    private readonly storage: StorageService,
  ) {}

  toProfile(user: User): UserProfile {
    return {
      id: user.id,
      role: user.role,
      status: user.status,
      email: user.email,
      fullName: user.fullName,
    };
  }

  /**
   * Registra o perfil de advogado para um usuário existente.
   * - Valida as áreas de atuação (categorias) por slug.
   * - Cria o Lawyer (verificação PENDING), as especialidades e promove o papel.
   * Observação (OAB): a verificação da OAB é concluída pelo backoffice.
   */
  async registerLawyer(user: User, dto: LawyerRegistrationInput) {
    const existing = await this.prisma.lawyer.findUnique({ where: { userId: user.id } });
    if (existing) {
      throw new ConflictException('Perfil de advogado já cadastrado.');
    }

    const categories = await this.prisma.category.findMany({
      where: { slug: { in: dto.specialties } },
    });
    if (categories.length !== dto.specialties.length) {
      throw new BadRequestException('Uma ou mais áreas de atuação são inválidas.');
    }

    const lawyer = await this.prisma.$transaction(async (tx) => {
      const created = await tx.lawyer.create({
        data: {
          userId: user.id,
          oabNumber: dto.oabNumber,
          oabState: dto.oabState.toUpperCase(),
        },
      });

      await tx.lawyerSpecialty.createMany({
        data: categories.map((c) => ({ lawyerId: created.id, categoryId: c.id })),
      });

      // Etapas padrão do Kanban (configuráveis depois pelo advogado).
      await tx.kanbanStage.createMany({
        data: [
          { lawyerId: created.id, name: 'Triagem', order: 0 },
          { lawyerId: created.id, name: 'Petição', order: 1 },
          { lawyerId: created.id, name: 'Audiência', order: 2 },
          { lawyerId: created.id, name: 'Concluído', order: 3 },
        ],
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          role: 'LAWYER',
          fullName: dto.fullName,
          status: 'PENDING_VERIFICATION',
        },
      });

      return created;
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: 'LAWYER',
      action: 'LAWYER_REGISTER',
      entityType: 'Lawyer',
      entityId: lawyer.id,
      metadata: { oabState: lawyer.oabState, specialties: dto.specialties },
    });

    return {
      lawyerId: lawyer.id,
      verification: lawyer.verification,
    };
  }

  /** Perfil do advogado atual (inclui status de verificação). */
  async getMyLawyer(user: User) {
    const lawyer = await this.lawyerCtx.resolve(user);
    return {
      id: lawyer.id,
      oab: `${lawyer.oabNumber}/${lawyer.oabState}`,
      verification: lawyer.verification,
      verifiedAt: lawyer.verifiedAt,
    };
  }

  /** Gera URL assinada para upload do comprovante de OAB. */
  async verificationUploadUrl(user: User, dto: VerificationUploadUrlInput) {
    const lawyer = await this.lawyerCtx.resolve(user);
    const safeName = dto.fileName.replace(/[^\w.\-]/g, '_');
    const path = `lawyer-verification/${lawyer.id}/${randomUUID()}-${safeName}`;
    return this.storage.createUploadUrl(path);
  }

  /** Registra o comprovante de OAB enviado (purpose LAWYER_VERIFICATION). */
  async registerVerificationDoc(user: User, dto: RegisterVerificationDocInput) {
    const lawyer = await this.lawyerCtx.resolve(user);
    const doc = await this.prisma.document.create({
      data: {
        purpose: 'LAWYER_VERIFICATION',
        lawyerId: lawyer.id,
        uploadedById: user.id,
        storageBucket: this.storage.bucket(),
        storageKey: dto.storageKey,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        isEncrypted: true,
      },
    });
    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'LAWYER_DOC_UPLOAD',
      entityType: 'Document',
      entityId: doc.id,
      metadata: { lawyerId: lawyer.id },
    });
    return { id: doc.id, fileName: doc.fileName };
  }

  /** Lista os comprovantes de OAB do advogado atual. */
  async listVerificationDocs(user: User) {
    const lawyer = await this.lawyerCtx.resolve(user);
    const docs = await this.prisma.document.findMany({
      where: { lawyerId: lawyer.id, purpose: 'LAWYER_VERIFICATION', deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(
      docs.map(async (d) => ({
        id: d.id,
        fileName: d.fileName,
        createdAt: d.createdAt,
        downloadUrl: await this.storage.createDownloadUrl(d.storageKey),
      })),
    );
  }
}
