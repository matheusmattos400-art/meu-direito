import { generateText } from 'ai';
import {
  getDefaultProvider,
  resolveModel,
  type AiProvider,
  type ResolveModelOptions,
} from '../providers/index.js';
import { redactPii, rehydratePii } from '../guardrails/pii.js';
import { wrapUserContent } from '../guardrails/prompt-injection.js';
import { EDITOR_SYSTEM_PROMPT } from '../prompts/pecas.js';
import { isMockMode } from '../triage/index.js';

export interface EditorAssistParams {
  instruction: string;
  currentContent?: string;
  caseSummary?: string;
  model?: ResolveModelOptions;
}

export interface EditorAssistResult {
  text: string;
  provider: AiProvider | 'mock';
  model: string | null;
  piiRedacted: boolean;
}

/** Assistência de redação dentro do editor de peças (uso do advogado). */
export async function assistLawyerEditor(
  params: EditorAssistParams,
): Promise<EditorAssistResult> {
  const map: Record<string, string> = {};
  let redacted = false;

  const instruction = redactPii(params.instruction);
  Object.assign(map, instruction.map);
  redacted = redacted || instruction.redacted;

  const content = params.currentContent ? redactPii(params.currentContent) : null;
  if (content) {
    Object.assign(map, content.map);
    redacted = redacted || content.redacted;
  }

  const summary = params.caseSummary ? redactPii(params.caseSummary) : null;
  if (summary) {
    Object.assign(map, summary.map);
    redacted = redacted || summary.redacted;
  }

  if (isMockMode()) {
    return {
      text:
        `[rascunho simulado a partir da instrução]\n\n${params.instruction}\n\n` +
        '(Configure uma API key e defina AI_MOCK=false para usar a IA real.)',
      provider: 'mock',
      model: null,
      piiRedacted: redacted,
    };
  }

  const provider = params.model?.provider ?? getDefaultProvider();
  const parts: string[] = [];
  if (summary) parts.push(`RESUMO DO CASO:\n${summary.text}`);
  if (content) parts.push(`TEXTO ATUAL DA PEÇA:\n${content.text}`);
  parts.push(`INSTRUÇÃO DO ADVOGADO:\n${instruction.text}`);

  const result = await generateText({
    model: resolveModel(params.model),
    system: EDITOR_SYSTEM_PROMPT,
    prompt: wrapUserContent(parts.join('\n\n')),
  });

  return {
    text: rehydratePii(result.text, map),
    provider,
    model: result.response?.modelId ?? null,
    piiRedacted: redacted,
  };
}
