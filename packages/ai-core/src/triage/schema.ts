import { z } from 'zod';

/**
 * Resultado estruturado da análise de triagem (gerado via generateObject).
 * Espelha o TriageResult de @app/types (sem o disclaimer, adicionado depois).
 */
export const triageAnalysisSchema = z.object({
  categorySlug: z.string().nullable().describe('slug da categoria jurídica, ou null se indefinido'),
  subcategorySlug: z.string().nullable().describe('slug da subcategoria, ou null'),
  potential: z
    .enum(['DOUBT', 'ADMINISTRATIVE', 'JUDICIAL'])
    .describe('dúvida simples, potencial administrativo ou potencial judicial'),
  sensitive: z.boolean().describe('true se o tema for sensível (ex.: violência, saúde, dados sensíveis)'),
  summary: z.string().describe('resumo estruturado do caso, em linguagem simples'),
  risks: z.array(z.string()).describe('riscos e pontos de atenção'),
  missingDocuments: z.array(z.string()).describe('documentos relevantes que faltam'),
  nextSteps: z.array(z.string()).describe('próximos passos sugeridos'),
  administrativePaths: z.array(z.string()).describe('caminhos administrativos cabíveis'),
  confidence: z.number().min(0).max(1).describe('confiança da classificação, de 0 a 1'),
});

export type TriageAnalysis = z.infer<typeof triageAnalysisSchema>;
