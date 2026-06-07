import { generateObject, generateText, type CoreMessage } from 'ai';
import {
  getDefaultProvider,
  resolveModel,
  type AiProvider,
  type ResolveModelOptions,
} from '../providers/index.js';
import { redactPii, rehydratePii } from '../guardrails/pii.js';
import { looksLikeInjection, wrapUserContent } from '../guardrails/prompt-injection.js';
import { AI_DISCLAIMER, ensureDisclaimer } from '../guardrails/disclaimer.js';
import { SENSITIVE_CASE_NOTE, TRIAGE_SYSTEM_PROMPT } from '../prompts/triage.js';
import { triageAnalysisSchema, type TriageAnalysis } from './schema.js';

export interface TriageMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Modo simulado: roda o fluxo sem chamar provedores reais (sem API key). */
export function isMockMode(): boolean {
  return process.env.AI_MOCK === 'true';
}

// --------- pseudonimização de uma lista de mensagens ---------
interface RedactedBundle {
  messages: TriageMessage[];
  map: Record<string, string>;
  redacted: boolean;
}

function redactConversation(messages: TriageMessage[]): RedactedBundle {
  const map: Record<string, string> = {};
  let redacted = false;
  const out = messages.map((m) => {
    const r = redactPii(m.content);
    Object.assign(map, r.map);
    if (r.redacted) redacted = true;
    return { role: m.role, content: r.text };
  });
  return { messages: out, map, redacted };
}

// ===================== RESPOSTA DE CHAT =====================
export interface TriageReplyParams {
  history: TriageMessage[];
  userMessage: string;
  sensitive?: boolean;
  model?: ResolveModelOptions;
}

export interface TriageReplyResult {
  reply: string;
  piiRedacted: boolean;
  flaggedInjection: boolean;
  provider: AiProvider | 'mock';
  model: string | null;
  usage?: { promptTokens?: number; completionTokens?: number };
}

export async function generateTriageReply(
  params: TriageReplyParams,
): Promise<TriageReplyResult> {
  const flaggedInjection = looksLikeInjection(params.userMessage);
  const userR = redactPii(params.userMessage);
  const histR = redactConversation(params.history);
  const fullMap = { ...histR.map, ...userR.map };
  const piiRedacted = userR.redacted || histR.redacted;

  if (isMockMode()) {
    return {
      reply: ensureDisclaimer(
        'Recebi seu relato. Para entender melhor, você pode me dizer quando isso aconteceu e ' +
          'se possui algum documento relacionado? (resposta simulada — configure uma API key e ' +
          'defina AI_MOCK=false para usar a IA real)',
      ),
      piiRedacted,
      flaggedInjection,
      provider: 'mock',
      model: null,
    };
  }

  const provider = params.model?.provider ?? getDefaultProvider();
  const system =
    TRIAGE_SYSTEM_PROMPT + (params.sensitive ? `\n\n${SENSITIVE_CASE_NOTE}` : '');

  const messages: CoreMessage[] = [
    ...histR.messages.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: wrapUserContent(userR.text) },
  ];

  const result = await generateText({ model: resolveModel(params.model), system, messages });

  const reply = ensureDisclaimer(rehydratePii(result.text, fullMap));
  return {
    reply,
    piiRedacted,
    flaggedInjection,
    provider,
    model: result.response?.modelId ?? null,
    usage: {
      promptTokens: result.usage?.promptTokens,
      completionTokens: result.usage?.completionTokens,
    },
  };
}

// ===================== ANÁLISE ESTRUTURADA =====================
export interface AvailableCategory {
  slug: string;
  name: string;
  subcategories: Array<{ slug: string; name: string }>;
}

export interface AnalyzeTriageParams {
  history: TriageMessage[];
  categories: AvailableCategory[];
  model?: ResolveModelOptions;
}

export interface TriageAnalysisResult extends TriageAnalysis {
  disclaimer: string;
  provider: AiProvider | 'mock';
}

function rehydrateAnalysis(a: TriageAnalysis, map: Record<string, string>): TriageAnalysis {
  const fix = (s: string) => rehydratePii(s, map);
  return {
    ...a,
    summary: fix(a.summary),
    risks: a.risks.map(fix),
    missingDocuments: a.missingDocuments.map(fix),
    nextSteps: a.nextSteps.map(fix),
    administrativePaths: a.administrativePaths.map(fix),
  };
}

export async function analyzeTriage(
  params: AnalyzeTriageParams,
): Promise<TriageAnalysisResult> {
  const histR = redactConversation(params.history);

  if (isMockMode()) {
    const first = params.categories[0];
    const analysis: TriageAnalysis = {
      categorySlug: first?.slug ?? null,
      subcategorySlug: first?.subcategories[0]?.slug ?? null,
      potential: 'DOUBT',
      sensitive: false,
      summary: 'Resumo simulado do caso para fins de desenvolvimento.',
      risks: ['Análise simulada — sem riscos reais identificados.'],
      missingDocuments: ['Documento de identificação'],
      nextSteps: ['Reunir documentos', 'Aguardar análise de um advogado'],
      administrativePaths: [],
      confidence: 0.5,
    };
    return { ...analysis, disclaimer: AI_DISCLAIMER, provider: 'mock' };
  }

  const provider = params.model?.provider ?? getDefaultProvider();
  const catalog = params.categories
    .map(
      (c) =>
        `- ${c.slug} (${c.name}): ${c.subcategories.map((s) => s.slug).join(', ') || '—'}`,
    )
    .join('\n');

  const system = `${TRIAGE_SYSTEM_PROMPT}

TAREFA: produza a análise estruturada da triagem. Use SOMENTE os slugs de categoria/subcategoria abaixo (ou null se nenhum se aplicar):
${catalog}`;

  const conversation = histR.messages
    .map((m) => `${m.role === 'user' ? 'Cidadão' : 'Assistente'}: ${m.content}`)
    .join('\n\n');

  const { object } = await generateObject({
    model: resolveModel(params.model),
    schema: triageAnalysisSchema,
    system,
    prompt: wrapUserContent(conversation),
  });

  return {
    ...rehydrateAnalysis(object, histR.map),
    disclaimer: AI_DISCLAIMER,
    provider,
  };
}

export { triageAnalysisSchema };
export type { TriageAnalysis };
