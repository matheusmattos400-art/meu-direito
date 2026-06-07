import { Injectable, Logger } from '@nestjs/common';
import { chunkText, embedText } from '@app/ai-core';
import { Prisma, type User } from '@app/db';
import type { IngestKnowledgeInput } from '@app/validation';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

interface ChunkHit {
  content: string;
  source: string;
  distance: number;
}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Busca os trechos mais próximos da consulta (cosine distance via pgvector). */
  async search(query: string, topK = 4): Promise<ChunkHit[]> {
    if (!query.trim()) return [];
    try {
      const embedding = await embedText(query);
      const literal = `[${embedding.join(',')}]`;
      return await this.prisma.$queryRaw<ChunkHit[]>(Prisma.sql`
        SELECT content, source, (embedding <=> ${literal}::vector) AS distance
        FROM knowledge_chunks
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> ${literal}::vector
        LIMIT ${topK}
      `);
    } catch (err) {
      // Degradação graciosa: sem pgvector/base, a triagem segue sem contexto.
      this.logger.warn(`Busca RAG indisponível: ${(err as Error).message}`);
      return [];
    }
  }

  /** Monta o bloco de contexto jurídico para injetar no prompt da triagem. */
  async buildContext(query: string): Promise<string | undefined> {
    const hits = await this.search(query);
    if (hits.length === 0) return undefined;
    return hits.map((h, i) => `[${i + 1}] (${h.source}) ${h.content}`).join('\n\n');
  }

  /** Ingestão: divide em chunks, gera embeddings e grava (insert via SQL bruto). */
  async ingest(admin: User, dto: IngestKnowledgeInput) {
    const chunks = chunkText(dto.content);

    const doc = await this.prisma.knowledgeDocument.create({
      data: { title: dto.title, source: dto.source, type: dto.type },
    });

    for (const chunk of chunks) {
      const embedding = await embedText(chunk);
      const literal = `[${embedding.join(',')}]`;
      await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO knowledge_chunks (id, "documentId", content, source, embedding, "createdAt")
        VALUES (gen_random_uuid(), ${doc.id}, ${chunk}, ${dto.source}, ${literal}::vector, now())
      `);
    }

    await this.audit.log({
      actorId: admin.id,
      actorRole: 'ADMIN',
      action: 'KNOWLEDGE_INGEST',
      entityType: 'KnowledgeDocument',
      entityId: doc.id,
      metadata: { chunks: chunks.length, type: dto.type },
    });

    return { documentId: doc.id, chunks: chunks.length };
  }

  async listDocuments() {
    const docs = await this.prisma.knowledgeDocument.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { chunks: true } } },
    });
    return docs.map((d) => ({
      id: d.id,
      title: d.title,
      source: d.source,
      type: d.type,
      chunks: d._count.chunks,
      createdAt: d.createdAt,
    }));
  }
}
