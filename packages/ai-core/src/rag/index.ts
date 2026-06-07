import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import { isMockMode } from '../triage/index.js';

/**
 * Embeddings para o RAG jurídico.
 * Usa OpenAI text-embedding-3-small (1536 dims) quando há OPENAI_API_KEY;
 * caso contrário, gera um embedding determinístico (mock) para desenvolver
 * o pipeline sem credencial. A dimensão deve casar com a coluna vector(1536).
 */
export const EMBEDDING_DIM = 1536;
export const EMBEDDING_MODEL = 'text-embedding-3-small';

export async function embedText(text: string): Promise<number[]> {
  if (isMockMode() || !process.env.OPENAI_API_KEY) {
    return mockEmbedding(text);
  }
  const { embedding } = await embed({
    model: openai.embedding(EMBEDDING_MODEL),
    value: text,
  });
  return embedding;
}

/** Divide um texto em chunks por parágrafos, respeitando um tamanho máximo. */
export function chunkText(text: string, maxLen = 1000): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buffer = '';
  for (const p of paragraphs) {
    const candidate = buffer ? `${buffer}\n\n${p}` : p;
    if (candidate.length > maxLen && buffer) {
      chunks.push(buffer);
      buffer = p;
    } else {
      buffer = candidate;
    }
  }
  if (buffer) chunks.push(buffer);
  if (chunks.length === 0 && text.trim()) chunks.push(text.trim());
  return chunks;
}

/** Embedding determinístico (somente desenvolvimento, sem provedor real). */
function mockEmbedding(text: string): number[] {
  let seed = 0;
  for (let i = 0; i < text.length; i++) {
    seed = (seed * 31 + text.charCodeAt(i)) >>> 0;
  }
  const out: number[] = new Array(EMBEDDING_DIM);
  let x = seed || 1;
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    x = (1103515245 * x + 12345) & 0x7fffffff;
    out[i] = (x / 0x7fffffff) * 2 - 1;
  }
  const norm = Math.sqrt(out.reduce((s, v) => s + v * v, 0)) || 1;
  return out.map((v) => v / norm);
}
