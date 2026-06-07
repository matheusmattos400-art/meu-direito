/**
 * Catálogo de planos SaaS para advogados.
 * Receita exclusivamente por ASSINATURA — sem comissão por caso (ética OAB).
 * Planos diferenciados por volumetria de casos triados e nº de áreas de atuação.
 */
export interface Plan {
  code: string;
  name: string;
  priceBRL: number;
  casesPerMonth: number;
  areas: number;
  highlights: string[];
}

export const PLANS: Plan[] = [
  {
    code: 'STARTER',
    name: 'Starter',
    priceBRL: 49.9,
    casesPerMonth: 10,
    areas: 1,
    highlights: ['1 área de atuação', 'Até 10 casos triados/mês', 'Workspace e Kanban'],
  },
  {
    code: 'PRO',
    name: 'Pro',
    priceBRL: 149.9,
    casesPerMonth: 50,
    areas: 3,
    highlights: ['3 áreas de atuação', 'Até 50 casos triados/mês', 'Editor de peças com IA'],
  },
  {
    code: 'BUSINESS',
    name: 'Business',
    priceBRL: 349.9,
    casesPerMonth: 1000,
    areas: 10,
    highlights: ['Até 10 áreas', 'Volume alto de casos', 'Prioridade no suporte'],
  },
];

export const PLAN_CODES = PLANS.map((p) => p.code) as [string, ...string[]];

export function findPlan(code: string): Plan | undefined {
  return PLANS.find((p) => p.code === code);
}
