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

    // Resolve o tribunal pelo número CNJ (preferencial) ou pela sigla informada.
    const alias = this.resolveAliasFromNumber(processNumber) ?? this.resolveAlias(court);
    if (!alias) {
      this.logger.warn(`Tribunal não resolvido para ${processNumber} (court=${court}).`);
      return { court: court ?? null, className: null, subject: null, movements: [] };
    }

    const apiKey = this.config.get<string>('DATAJUD_API_KEY');
    const res = await fetch(`${DatajudService.BASE}/${alias}/_search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `APIKey ${apiKey}`,
      },
      body: JSON.stringify({
        size: 50,
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
    const hits =
      (body as { hits?: { hits?: Array<{ _source?: Record<string, unknown> }> } })?.hits?.hits ?? [];

    let className: string | null = null;
    let subject: string | null = null;
    let tribunal: string | null = null;
    const movements: DatajudMovement[] = [];
    const seen = new Set<string>();

    // O Datajud retorna um registro por instância (G1, G2…). Mesclamos os
    // movimentos de todas para montar a linha do tempo completa.
    for (const h of hits) {
      const source = h._source ?? {};
      tribunal = tribunal ?? ((source['tribunal'] as string) ?? null);
      className = className ?? ((source['classe'] as { nome?: string })?.nome ?? null);
      subject =
        subject ??
        (Array.isArray(source['assuntos'])
          ? ((source['assuntos'] as Array<{ nome?: string }>)[0]?.nome ?? null)
          : null);

      const movimentos = Array.isArray(source['movimentos'])
        ? (source['movimentos'] as Array<Record<string, unknown>>)
        : [];
      for (const m of movimentos) {
        const cnjCode = m['codigo'] != null ? String(m['codigo']) : null;
        const rawText = String(m['nome'] ?? '');
        const occurredAt = m['dataHora'] ? new Date(String(m['dataHora'])) : null;
        const key = `${cnjCode ?? ''}|${rawText}|${occurredAt?.toISOString() ?? ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        movements.push({ cnjCode, rawText, occurredAt });
      }
    }

    return { court: tribunal ?? court ?? null, className, subject, movements };
  }

  private resolveAlias(court?: string): string | null {
    if (!court) return null;
    const c = court.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (c.startsWith('api_publica_')) return c;
    // Siglas comuns: tjsp, trf1, trt2, tre_sp, stj…
    if (/^(tj|trt|trf|tre|tjm)[a-z0-9_]+$/.test(c) || c === 'stj' || c === 'tst' || c === 'tse') {
      return `api_publica_${c}`;
    }
    return null;
  }

  // TR (01..27) -> UF, conforme tabela CNJ (Justiça Estadual e Eleitoral).
  private static readonly UF_BY_TR = [
    '', 'ac', 'al', 'ap', 'am', 'ba', 'ce', 'df', 'es', 'go', 'ma', 'mt', 'ms', 'mg',
    'pa', 'pb', 'pr', 'pe', 'pi', 'rj', 'rn', 'rs', 'ro', 'rr', 'sc', 'se', 'sp', 'to',
  ];

  /**
   * Deriva o índice (alias) do tribunal a partir do número CNJ
   * (NNNNNNN-DD.AAAA.J.TR.OOOO): J = segmento, TR = tribunal.
   */
  private resolveAliasFromNumber(processNumber: string): string | null {
    const d = processNumber.replace(/\D/g, '');
    if (d.length !== 20) return null;
    const segment = d[13];
    const tr = Number(d.slice(14, 16));
    switch (segment) {
      case '8': // Justiça Estadual
        return DatajudService.UF_BY_TR[tr] ? `api_publica_tj${DatajudService.UF_BY_TR[tr]}` : null;
      case '4': // Justiça Federal (TRF1..TRF6)
        return tr >= 1 && tr <= 6 ? `api_publica_trf${tr}` : null;
      case '5': // Justiça do Trabalho (TRT1..TRT24)
        return tr >= 1 && tr <= 24 ? `api_publica_trt${tr}` : null;
      case '6': // Justiça Eleitoral (TRE por UF)
        return DatajudService.UF_BY_TR[tr] ? `api_publica_tre_${DatajudService.UF_BY_TR[tr]}` : null;
      case '3': // STJ
        return 'api_publica_stj';
      default:
        return null;
    }
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
