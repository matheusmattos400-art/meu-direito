import { generateText } from 'ai';
import {
  getDefaultProvider,
  resolveModel,
  type AiProvider,
  type ResolveModelOptions,
} from '../providers/index.js';
import { redactPii, rehydratePii } from '../guardrails/pii.js';
import { wrapUserContent } from '../guardrails/prompt-injection.js';
import { MOVEMENT_SYSTEM_PROMPT } from '../prompts/processos.js';
import { isMockMode } from '../triage/index.js';

export interface SimplifyMovementParams {
  rawText: string;
  cnjCode?: string;
  model?: ResolveModelOptions;
}

export interface SimplifyMovementResult {
  text: string;
  provider: AiProvider | 'mock';
}

/** Traduz uma movimentação processual para linguagem simples. */
export async function simplifyMovement(
  params: SimplifyMovementParams,
): Promise<SimplifyMovementResult> {
  const redacted = redactPii(params.rawText);

  if (isMockMode()) {
    return {
      text: `Em termos simples: ${params.rawText.slice(0, 160)}`,
      provider: 'mock',
    };
  }

  const provider = params.model?.provider ?? getDefaultProvider();
  const result = await generateText({
    model: resolveModel(params.model),
    system: MOVEMENT_SYSTEM_PROMPT,
    prompt: wrapUserContent(redacted.text),
  });

  return { text: rehydratePii(result.text, redacted.map), provider };
}
