import { BadRequestException, Injectable } from '@nestjs/common';
import type { User } from '@app/db';
import type {
  LawyerRegistrationInput,
  RegisterVerificationDocInput,
  VerificationUploadUrlInput,
} from '@app/validation';
import type { DocumentKind } from '@app/db';
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
  isOwner: boolean;
  adminScopes: string[];
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
      isOwner: user.isOwner,
      adminScopes: user.adminScopes,
    };
  }

  /**
   * Cadastro/edição do perfil profissional do advogado (formulário completo).
   * Cria ou atualiza o Lawyer; status inicial PRE_REGISTRATION. A análise e a
   * ativação são feitas pelo backoffice após o envio de documentos + termo.
   */
  async registerLawyer(user: User, dto: LawyerRegistrationInput) {
    const categories = await this.prisma.category.findMany({
      where: { slug: { in: dto.specialties } },
    });
    if (categories.length !== dto.specialties.length) {
      throw new BadRequestException('Uma ou mais áreas de atuação são inválidas.');
    }

    const birthDate = new Date(dto.birthDate);
    const profile = {
      oabNumber: dto.oabNumber,
      oabState: dto.oabState.toUpperCase(),
      cpf: dto.cpf,
      phone: dto.phone,
      phone2: dto.phone2 ?? null,
      birthDate: Number.isNaN(birthDate.getTime()) ? null : birthDate,
      city: dto.city ?? null,
      avatarUrl: dto.avatarUrl ? dto.avatarUrl : null,
      residentialAddress: dto.residentialAddress,
      professionalAddress: dto.professionalAddress,
    };

    const lawyer = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.lawyer.upsert({
        where: { userId: user.id },
        update: profile,
        create: { userId: user.id, status: 'PRE_REGISTRATION', ...profile },
      });

      // Áreas de atuação: redefine para refletir o formulário atual.
      await tx.lawyerSpecialty.deleteMany({ where: { lawyerId: saved.id } });
      await tx.lawyerSpecialty.createMany({
        data: categories.map((c) => ({ lawyerId: saved.id, categoryId: c.id })),
      });

      // Cria as etapas padrão do Kanban apenas na primeira vez.
      const stages = await tx.kanbanStage.count({ where: { lawyerId: saved.id } });
      if (stages === 0) {
        await tx.kanbanStage.createMany({
          data: [
            { lawyerId: saved.id, name: 'Triagem', order: 0 },
            { lawyerId: saved.id, name: 'Petição', order: 1 },
            { lawyerId: saved.id, name: 'Audiência', order: 2 },
            { lawyerId: saved.id, name: 'Concluído', order: 3 },
          ],
        });
      }

      await tx.user.update({
        where: { id: user.id },
        data: {
          role: 'LAWYER',
          fullName: dto.fullName,
          ...(dto.email ? { email: dto.email } : {}),
        },
      });

      return saved;
    }, { maxWait: 15_000, timeout: 30_000 });

    await this.audit.log({
      actorId: user.id,
      actorRole: 'LAWYER',
      action: 'LAWYER_REGISTER',
      entityType: 'Lawyer',
      entityId: lawyer.id,
      metadata: { oabState: lawyer.oabState, specialties: dto.specialties },
    });

    return { lawyerId: lawyer.id, status: lawyer.status };
  }

  /** Aceite do termo de responsabilidade. */
  async acceptTerm(user: User) {
    const lawyer = await this.lawyerCtx.resolve(user);
    await this.prisma.lawyer.update({
      where: { id: lawyer.id },
      data: { termAccepted: true, termAcceptedAt: new Date() },
    });
    await this.audit.log({
      actorId: user.id,
      actorRole: 'LAWYER',
      action: 'LAWYER_TERM_ACCEPT',
      entityType: 'Lawyer',
      entityId: lawyer.id,
    });
    return { termAccepted: true };
  }

  /** Envia o cadastro para análise (exige documentos + termo). Inicia o SLA de 24h. */
  async submitForAnalysis(user: User) {
    const lawyer = await this.lawyerCtx.resolve(user);
    if (!lawyer.termAccepted) {
      throw new BadRequestException('É necessário aceitar o termo de responsabilidade.');
    }

    const docs = await this.prisma.document.findMany({
      where: { lawyerId: lawyer.id, purpose: 'LAWYER_VERIFICATION', deletedAt: null },
      select: { kind: true },
    });
    const kinds = new Set(docs.map((d) => d.kind));
    const required: DocumentKind[] = ['IDENTITY', 'OAB', 'RESIDENCE'];
    const missing = required.filter((k) => !kinds.has(k));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Envie todos os documentos antes da análise (faltam: ${missing.join(', ')}).`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.lawyer.update({
        where: { id: lawyer.id },
        data: { status: 'IN_ANALYSIS', submittedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { status: 'PENDING_VERIFICATION' },
      }),
    ]);

    await this.audit.log({
      actorId: user.id,
      actorRole: 'LAWYER',
      action: 'LAWYER_SUBMIT_ANALYSIS',
      entityType: 'Lawyer',
      entityId: lawyer.id,
    });
    return { status: 'IN_ANALYSIS' };
  }

  /** Perfil do advogado atual (status + dados do formulário para pré-preencher). */
  async getMyLawyer(user: User) {
    const lawyer = await this.lawyerCtx.resolve(user);
    return {
      id: lawyer.id,
      status: lawyer.status,
      fullName: user.fullName,
      email: user.email,
      cpf: lawyer.cpf,
      phone: lawyer.phone,
      phone2: lawyer.phone2,
      birthDate: lawyer.birthDate,
      city: lawyer.city,
      avatarUrl: lawyer.avatarUrl,
      oabNumber: lawyer.oabNumber,
      oabState: lawyer.oabState,
      residentialAddress: lawyer.residentialAddress,
      professionalAddress: lawyer.professionalAddress,
      termAccepted: lawyer.termAccepted,
      submittedAt: lawyer.submittedAt,
    };
  }

  /** Gera URL assinada para upload de um documento (por tipo). */
  async verificationUploadUrl(user: User, dto: VerificationUploadUrlInput) {
    const lawyer = await this.lawyerCtx.resolve(user);
    const safeName = dto.fileName.replace(/[^\w.\-]/g, '_');
    const path = `lawyer-verification/${lawyer.id}/${dto.kind.toLowerCase()}/${randomUUID()}-${safeName}`;
    return this.storage.createUploadUrl(path);
  }

  /** Registra um documento enviado (ID/OAB/residência); substitui o anterior do mesmo tipo. */
  async registerVerificationDoc(user: User, dto: RegisterVerificationDocInput) {
    const lawyer = await this.lawyerCtx.resolve(user);

    await this.prisma.document.updateMany({
      where: { lawyerId: lawyer.id, purpose: 'LAWYER_VERIFICATION', kind: dto.kind, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    const doc = await this.prisma.document.create({
      data: {
        purpose: 'LAWYER_VERIFICATION',
        kind: dto.kind,
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
      metadata: { lawyerId: lawyer.id, kind: dto.kind },
    });
    return { id: doc.id, kind: dto.kind, fileName: doc.fileName };
  }

  /** Lista os documentos do advogado atual (com tipo). */
  async listVerificationDocs(user: User) {
    const lawyer = await this.lawyerCtx.resolve(user);
    const docs = await this.prisma.document.findMany({
      where: { lawyerId: lawyer.id, purpose: 'LAWYER_VERIFICATION', deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return docs.map((d) => ({
      id: d.id,
      kind: d.kind,
      fileName: d.fileName,
      createdAt: d.createdAt,
    }));
  }
}
