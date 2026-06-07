/**
 * @app/ai-core — camada de IA da plataforma.
 *
 * Exporta a abstração multi-provedor, os guardrails (PII, anti-injection,
 * disclaimer) e os prompts versionados. A orquestração da triagem (RAG +
 * geração estruturada) será montada sobre estas peças na próxima etapa.
 */
export * from './providers/index.js';
export * from './guardrails/pii.js';
export * from './guardrails/disclaimer.js';
export * from './guardrails/prompt-injection.js';
export * from './prompts/triage.js';
export * from './prompts/pecas.js';
export * from './prompts/processos.js';
export * from './triage/schema.js';
export * from './triage/index.js';
export * from './editor/index.js';
export * from './processos/index.js';
