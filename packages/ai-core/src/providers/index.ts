import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';

/**
 * Abstração multi-provedor de LLM.
 *
 * O resto do sistema NUNCA importa um SDK de provedor diretamente — sempre
 * resolve o modelo por aqui. Isso permite trocar de provedor por tarefa/custo
 * sem tocar na lógica de negócio.
 */
export type AiProvider = 'anthropic' | 'openai' | 'google';

/** Modelos padrão por provedor (ajustáveis por env/feature flag). */
const DEFAULT_MODELS: Record<AiProvider, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o',
  google: 'gemini-1.5-pro',
};

export interface ResolveModelOptions {
  provider?: AiProvider;
  model?: string;
}

export function getDefaultProvider(): AiProvider {
  const p = process.env.AI_DEFAULT_PROVIDER as AiProvider | undefined;
  return p ?? 'anthropic';
}

/** Resolve um LanguageModel da Vercel AI SDK a partir de provedor + modelo. */
export function resolveModel(opts: ResolveModelOptions = {}): LanguageModel {
  const provider = opts.provider ?? getDefaultProvider();
  const model = opts.model ?? DEFAULT_MODELS[provider];

  switch (provider) {
    case 'anthropic':
      return anthropic(model);
    case 'openai':
      return openai(model);
    case 'google':
      return google(model);
    default:
      throw new Error(`Provedor de IA não suportado: ${provider as string}`);
  }
}
