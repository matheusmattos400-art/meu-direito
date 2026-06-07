/**
 * Tipos compartilhados entre web, api e (futuro) mobile.
 * Tipos derivados do banco vêm de @app/db (Prisma); aqui ficam contratos
 * de transporte (DTOs), envelopes de resposta e constantes de domínio.
 */

/** Envelope padrão de resposta da API. */
export interface ApiResponse<T> {
  data: T;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
  };
}

export interface ApiError {
  statusCode: number;
  message: string;
  code?: string;
}

/** Resultado estruturado da triagem produzida pela IA (Módulo A). */
export interface TriageResult {
  categorySlug: string | null;
  subcategorySlug: string | null;
  potential: 'DOUBT' | 'ADMINISTRATIVE' | 'JUDICIAL';
  sensitive: boolean;
  summary: string;
  risks: string[];
  missingDocuments: string[];
  nextSteps: string[];
  administrativePaths: string[];
  confidence: number; // 0..1
  /** Aviso obrigatório de limitação da IA (ética OAB). */
  disclaimer: string;
}

/** Terminologia pública controlada (ética OAB) — nunca usar "lead". */
export const PUBLIC_TERMS = {
  case: 'caso triado',
  qualifiedRequest: 'solicitação qualificada',
  opportunity: 'oportunidade de atendimento',
  directory: 'diretório de profissionais',
} as const;
