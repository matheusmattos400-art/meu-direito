/**
 * Tradutor de movimentos processuais para linguagem clara.
 *
 * Os movimentos do Datajud seguem a Tabela Processual Unificada (TPU) do CNJ.
 * Aqui mapeamos os movimentos mais comuns (por nome) para uma explicação que
 * tanto o cidadão quanto o advogado entendem rapidamente. É determinístico
 * (não depende de IA); a IA, quando configurada, complementa casos atípicos.
 */

interface Glossary {
  match: string[]; // termos (sem acento, minúsculos) que identificam o movimento
  explain: string;
}

const GLOSSARY: Glossary[] = [
  { match: ['distribuicao'], explain: 'O processo foi distribuído a uma vara/relator — é o ponto de partida da tramitação.' },
  { match: ['autuacao'], explain: 'O processo foi autuado (registrado e organizado nos autos).' },
  { match: ['conclusao', 'conclusos'], explain: 'Os autos foram enviados ao juiz ou relator para análise e decisão.' },
  { match: ['publicacao'], explain: 'Um ato foi publicado oficialmente (Diário da Justiça) — em geral, inicia a contagem de prazos.' },
  { match: ['intimacao'], explain: 'Uma das partes foi intimada (comunicada) sobre um ato do processo.' },
  { match: ['citacao'], explain: 'A parte contrária foi citada — comunicada formalmente de que existe uma ação contra ela.' },
  { match: ['juntada', 'documento', 'peticao'], explain: 'Um documento ou petição foi anexado aos autos do processo.' },
  { match: ['decurso de prazo', 'decurso'], explain: 'Um prazo se encerrou — com ou sem manifestação da parte.' },
  { match: ['despacho'], explain: 'O juiz deu um despacho de andamento (impulsiona o processo, sem decidir o mérito).' },
  { match: ['decisao'], explain: 'O juiz proferiu uma decisão sobre uma questão do processo.' },
  { match: ['sentenca'], explain: 'O juiz proferiu a sentença, decidindo o mérito em 1ª instância.' },
  { match: ['acordao'], explain: 'O tribunal (colegiado) proferiu acórdão — a decisão do julgamento do recurso.' },
  { match: ['provimento'], explain: 'O recurso foi acolhido (provido) — quem recorreu teve razão, no todo ou em parte.' },
  { match: ['nao-provimento', 'negado provimento', 'improvido', 'nao provido'], explain: 'O recurso foi negado — a decisão anterior foi mantida.' },
  { match: ['parcial provimento', 'parcialmente'], explain: 'O recurso foi acolhido em parte.' },
  { match: ['designada audiencia', 'audiencia'], explain: 'Foi designada/realizada uma audiência.' },
  { match: ['remessa'], explain: 'Os autos foram enviados a outro órgão ou instância.' },
  { match: ['recebimento', 'recebidos'], explain: 'Os autos ou o recurso foram recebidos pelo órgão julgador.' },
  { match: ['expedicao', 'expedido', 'mandado', 'oficio', 'carta'], explain: 'Foi expedido um documento/comunicação (mandado, ofício ou carta).' },
  { match: ['arquivamento', 'arquivado'], explain: 'O processo foi arquivado.' },
  { match: ['desarquivamento'], explain: 'O processo foi desarquivado e voltou a tramitar.' },
  { match: ['baixa definitiva', 'baixa'], explain: 'O processo foi baixado naquele tribunal — em regra, encerra aquela fase ou instância.' },
  { match: ['transito em julgado', 'transitado'], explain: 'A decisão transitou em julgado: não cabe mais recurso.' },
  { match: ['homologacao', 'homologado'], explain: 'O juiz homologou (confirmou oficialmente) um ato ou acordo.' },
  { match: ['embargos'], explain: 'Foram opostos embargos (recurso/defesa contra uma decisão).' },
  { match: ['apelacao'], explain: 'Foi interposta apelação — recurso contra a sentença.' },
  { match: ['agravo'], explain: 'Foi interposto agravo — recurso contra uma decisão ao longo do processo.' },
  { match: ['recurso'], explain: 'Foi apresentado um recurso contra uma decisão.' },
  { match: ['cumprimento de sentenca'], explain: 'Iniciou-se o cumprimento da sentença (cobrança do que foi decidido).' },
  { match: ['penhora'], explain: 'Foi realizada penhora de bens para garantir o pagamento.' },
  { match: ['suspensao', 'suspenso'], explain: 'O processo foi suspenso temporariamente.' },
  { match: ['extincao', 'extinto'], explain: 'O processo foi extinto (encerrado).' },
];

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Explica um movimento processual em linguagem clara. */
export function explainMovement(name: string, _code?: string | null): string {
  const n = normalize(name);
  for (const g of GLOSSARY) {
    if (g.match.some((term) => n.includes(term))) return g.explain;
  }
  return `Andamento registrado: "${name}".`;
}
