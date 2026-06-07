/**
 * Pseudonimização de PII antes do envio ao LLM.
 *
 * Provedores de IA processam dados fora do Brasil (transferência internacional).
 * Por isso, dados pessoais diretos são substituídos por placeholders antes de
 * sair da nossa infraestrutura. O mapa reverso permite re-hidratar a saída
 * quando exibida ao usuário (nunca persistido em log).
 *
 * Cobertura inicial (heurística por regex BR). Deve ser revisada/expandida
 * com testes; não é substituto de avaliação jurídica do DPO.
 */
export interface PiiRedactionResult {
  text: string;
  /** placeholder -> valor original (para re-hidratar a resposta). */
  map: Record<string, string>;
  redacted: boolean;
}

const PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: 'CPF', regex: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g },
  { label: 'CNPJ', regex: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g },
  { label: 'EMAIL', regex: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g },
  { label: 'PHONE', regex: /\b(?:\+55\s?)?\(?\d{2}\)?\s?9?\d{4}-?\d{4}\b/g },
  { label: 'CEP', regex: /\b\d{5}-?\d{3}\b/g },
];

export function redactPii(input: string): PiiRedactionResult {
  const map: Record<string, string> = {};
  const counters: Record<string, number> = {};
  let text = input;
  let redacted = false;

  for (const { label, regex } of PATTERNS) {
    text = text.replace(regex, (match) => {
      redacted = true;
      counters[label] = (counters[label] ?? 0) + 1;
      const placeholder = `[${label}_${counters[label]}]`;
      map[placeholder] = match;
      return placeholder;
    });
  }

  return { text, map, redacted };
}

/** Re-hidrata os placeholders na resposta do LLM antes de exibir ao usuário. */
export function rehydratePii(text: string, map: Record<string, string>): string {
  let result = text;
  for (const [placeholder, original] of Object.entries(map)) {
    result = result.split(placeholder).join(original);
  }
  return result;
}
