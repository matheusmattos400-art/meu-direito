import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

interface JulgadoRow {
  id: string;
  court: string;
  processNumber: string | null;
  classe: string | null;
  orgaoJulgador: string | null;
  relator: string | null;
  publishedAt: Date | null;
  ementa: string;
  tese: string | null;
  tema: string | null;
  url: string | null;
}

const PAGE_SIZE = 10;

@Injectable()
export class JulgadosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Tribunais com julgados indexados (para o filtro da UI). */
  async courts() {
    const rows = await this.prisma.julgado.groupBy({ by: ['court'], _count: { _all: true } });
    return rows.map((r) => ({ court: r.court, count: r._count._all })).sort((a, b) => b.count - a.count);
  }

  /** Busca full-text (Postgres) por tema, com filtro de tribunal e paginação. */
  async search(q: string, courts: string[], page: number) {
    const take = PAGE_SIZE;
    const skip = Math.max(0, page) * take;

    const params: unknown[] = [q];
    let sql = `
      SELECT id, court, "processNumber", classe, "orgaoJulgador", relator,
             "publishedAt", ementa, tese, tema, url
      FROM julgados
      WHERE to_tsvector('portuguese', "searchText") @@ plainto_tsquery('portuguese', $1)`;
    if (courts.length > 0) {
      const placeholders = courts.map((_, i) => `$${i + 2}`).join(', ');
      sql += ` AND court IN (${placeholders})`;
      params.push(...courts);
    }
    sql += ` ORDER BY "publishedAt" DESC NULLS LAST LIMIT ${take + 1} OFFSET ${skip}`;

    const rows = await this.prisma.$queryRawUnsafe<JulgadoRow[]>(sql, ...params);
    const hasMore = rows.length > take;

    return {
      page,
      hasMore,
      items: rows.slice(0, take).map((r) => ({
        id: r.id,
        court: r.court,
        processNumber: r.processNumber,
        classe: r.classe,
        orgaoJulgador: r.orgaoJulgador,
        relator: r.relator,
        publishedAt: r.publishedAt,
        // ementa pode ser longa — devolvemos um trecho para a lista
        ementa: r.ementa.length > 700 ? `${r.ementa.slice(0, 700)}…` : r.ementa,
        tese: r.tese,
        tema: r.tema,
        url: r.url,
      })),
    };
  }
}
