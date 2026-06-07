/**
 * Disclaimer obrigatório (ética OAB).
 *
 * A IA nunca promete resultado e sempre indica que a validação final depende
 * de advogado habilitado. Aplicado como camada de código — não confiamos
 * apenas na instrução do prompt.
 */
export const AI_DISCLAIMER =
  'Esta é uma orientação informativa gerada por inteligência artificial e não ' +
  'substitui a análise de um advogado habilitado. Nenhum resultado é garantido. ' +
  'A validação jurídica final depende de um profissional.';

/** Termos que sugerem promessa de resultado — sinalizam revisão/bloqueio. */
const FORBIDDEN_PATTERNS: RegExp[] = [
  /\bgarant(o|ia|ido|imos|e)\b/i,
  /\bcom certeza (você )?(vai|irá) (ganhar|receber|vencer)\b/i,
  /\b100%\s*(de\s*)?(certeza|chance|garantido)\b/i,
  /\bresultado garantido\b/i,
];

export function violatesResultPromise(text: string): boolean {
  return FORBIDDEN_PATTERNS.some((re) => re.test(text));
}

/** Garante que a saída ao cidadão contenha o disclaimer. */
export function ensureDisclaimer(text: string): string {
  if (text.includes(AI_DISCLAIMER)) return text;
  return `${text}\n\n---\n${AI_DISCLAIMER}`;
}
