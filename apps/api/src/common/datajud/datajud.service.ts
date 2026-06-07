import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface DatajudMovement {
  cnjCode: string | null;
  rawText: string;
  occurredAt: Date | null;
}

export interface DatajudProcess {
  court: string | null;
  className: string | null;
  subject: string | null;
  movements: DatajudMovement[];
}

/**
 * Integração com a API Pública do Datajud (CNJ).
 *
 * Sem DATAJUD_API_KEY, opera em modo simulado (mock) — permite desenvolver
 * o fluxo de acompanhamento processual sem credencial. Com a chave, consulta
 * o endpoint público do tribunal correspondente.
 *
 * Observação: o Datajud expõe um índice por tribunal (alias, ex.:
 * "api_publica_tjsp"). O mapeamento completo número CNJ -> alias deve ser
 * complementado conforme os tribunais suportados.
 */
@Injectable()
export class DatajudService {
  private readonly logger = new Logger(DatajudService.name);
  private static readonly BASE = 'https://api-publica.datajud.cnj.jus.br';

  constructor(private readonly config: ConfigService) {}

  isMock(): boolean {
    return !this.config.get<string>('DATAJUD_API_KEY');
  }

  async fetchProcess(processNumber: string, court?: string): Promise<DatajudProcess> {
    if (this.isMock()) {
      return this.mockProcess(processNumber, court);
    }

    const alias = this.resolveAlias(court);
    if (!alias) {
      this.logger.warn(`Alias do tribunal não resolvido (court=${court}); usando mock.`);
      return this.mockProcess(processNumber, court);
    }

    const apiKey = this.config.get<string>('DATAJUD_API_KEY');
    const res = await fetch(`${DatajudService.BASE}/${alias}/_search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `APIKey ${apiKey}`,
      },
      body: JSON.stringify({
        query: { match: { numeroProcesso: processNumber.replace(/\D/g, '') } },
      }),
    });

    if (!res.ok) {
      this.logger.error(`Datajud respondeu ${res.status}`);
      return { court: court ?? null, className: null, subject: null, movements: [] };
    }

    return this.parseResponse((await res.json()) as unknown, court);
  }

  // ---------------- parsing ----------------
  private parseResponse(body: unknown, court?: string): DatajudProcess {
    const hits = (body as { hits?: { hits?: Array<{ _source?: Record<string, unknown> }> } })?.hits
      ?.hits;
    const source = hits?.[0]?._source ?? {};
    const movimentos = Array.isArray(source['movimentos'])
      ? (source['movimentos'] as Array<Record<string, unknown>>)
      : [];

    return {
      court: (source['tribunal'] as string) ?? court ?? null,
      className: (source['classe'] as { nome?: string })?.nome ?? null,
      subject:
        (Array.isArray(source['assuntos'])
          ? ((source['assuntos'] as Array<{ nome?: string }>)[0]?.nome ?? null)
          : null) ?? null,
      movements: movimentos.map((m) => ({
        cnjCode: m['codigo'] != null ? String(m['codigo']) : null,
        rawText: String(m['nome'] ?? ''),
        occurredAt: m['dataHora'] ? new Date(String(m['dataHora'])) : null,
      })),
    };
  }

  private resolveAlias(court?: string): string | null {
    if (!court) return null;
    const c = court.toLowerCase();
    // Aceita o alias direto, ou mapeia siglas comuns.
    if (c.startsWith('api_publica_')) return c;
    const map: Record<string, string> = {
      tjsp: 'api_publica_tjsp',
      tjrj: 'api_publica_tjrj',
      tjmg: 'api_publica_tjmg',
      trf1: 'api_publica_trf1',
      trf3: 'api_publica_trf3',
    };
    return map[c] ?? null;
  }

  // ---------------- mock ----------------
  private mockProcess(processNumber: string, court?: string): DatajudProcess {
    return {
      court: court ?? 'TJSP',
      className: 'Procedimento Comum Cível',
      subject: 'Indenização por Dano Moral',
      movements: [
        {
          cnjCode: '26',
          rawText: 'Distribuição por sorteio',
          occurredAt: null,
        },
        {
          cnjCode: '51',
          rawText: 'Designada audiência de conciliação',
          occurredAt: null,
        },
        {
          cnjCode: '12265',
          rawText: 'Conclusos para decisão',
          occurredAt: null,
        },
      ],
    };
  }
}
