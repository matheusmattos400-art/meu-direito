import { BadRequestException, Injectable } from '@nestjs/common';
import type { ConsentTermType, User } from '@app/db';
import type { GrantConsentInput } from '@app/validation';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class ConsentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Termos vigentes + se o usuário já consentiu cada um. */
  async listRequired(user: User) {
    const terms = await this.prisma.consentTerm.findMany({
      where: { isCurrent: true },
      orderBy: { type: 'asc' },
    });
    const consents = await this.prisma.userConsent.findMany({
      where: { userId: user.id },
    });
    const granted = new Map(consents.map((c) => [c.termId, c.granted]));

    return terms.map((t) => ({
      termId: t.id,
      type: t.type,
      version: t.version,
      title: t.title,
      content: t.content,
      granted: granted.get(t.id) ?? false,
    }));
  }

  /** Concede ou revoga um consentimento, registrando IP/User-Agent. */
  async setConsent(user: User, dto: GrantConsentInput, meta: RequestMeta) {
    const term = await this.prisma.consentTerm.findUnique({ where: { id: dto.termId } });
    if (!term) throw new BadRequestException('Termo de consentimento inválido.');

    const consent = await this.prisma.userConsent.upsert({
      where: { userId_termId: { userId: user.id, termId: dto.termId } },
      update: {
        granted: dto.granted,
        grantedAt: dto.granted ? new Date() : undefined,
        revokedAt: dto.granted ? null : new Date(),
        ipAddress: meta.ipAddress ?? null,
        userAgent: meta.userAgent ?? null,
      },
      create: {
        userId: user.id,
        termId: dto.termId,
        granted: dto.granted,
        ipAddress: meta.ipAddress ?? null,
        userAgent: meta.userAgent ?? null,
      },
    });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: dto.granted ? 'CONSENT_GRANT' : 'CONSENT_REVOKE',
      entityType: 'ConsentTerm',
      entityId: dto.termId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { type: term.type, version: term.version },
    });

    return { termId: consent.termId, granted: consent.granted };
  }

  /** Verifica se o usuário consentiu o termo vigente de um tipo. */
  async hasGranted(userId: string, type: ConsentTermType): Promise<boolean> {
    const term = await this.prisma.consentTerm.findFirst({
      where: { type, isCurrent: true },
    });
    if (!term) return false;
    const consent = await this.prisma.userConsent.findUnique({
      where: { userId_termId: { userId, termId: term.id } },
    });
    return consent?.granted ?? false;
  }
}
