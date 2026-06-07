import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { UserRole } from '@app/db';

export interface AuditEntry {
  actorId?: string | null;
  actorRole?: UserRole | null;
  action: string; // ACCEPT_CASE, UPLOAD_DOC, LAWYER_REGISTER…
  entityType: string; // Case, Document, Lawyer…
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Trilha de auditoria imutável (LGPD/OAB).
 * Toda ação sensível deve ser registrada aqui.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: entry.actorId ?? null,
          actorRole: entry.actorRole ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          metadata: (entry.metadata ?? undefined) as object | undefined,
          ipAddress: entry.ipAddress ?? null,
          userAgent: entry.userAgent ?? null,
        },
      });
    } catch (err) {
      // Auditoria nunca deve derrubar a operação principal; logamos a falha.
      this.logger.error(`Falha ao registrar auditoria (${entry.action})`, err as Error);
    }
  }
}
