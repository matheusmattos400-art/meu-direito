/**
 * Ingestão de julgados a partir dos Dados Abertos do STJ (gratuito e oficial).
 * Baixa os "Espelhos de acórdãos" (JSON), grava na tabela `julgados` e cria o
 * índice full-text (Postgres). Reexecutável (upsert por source+sourceId).
 *
 * Uso:  DATABASE_URL=... tsx prisma/ingest-julgados.ts [arquivosPorDataset]
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CKAN = 'https://dadosabertos.web.stj.jus.br/api/3/action';
const FILES_PER_DATASET = Number(process.argv[2] ?? 6);

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'application/json,text/plain,*/*',
};

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: HEADERS });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`resposta não-JSON (HTTP ${res.status}) de ${url.slice(0, 80)}`);
  }
}

function parsePublicacao(s?: string): Date | null {
  if (!s) return null;
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

function parseDecisao(s?: string): Date | null {
  if (!s || !/^\d{8}$/.test(s)) return null;
  return new Date(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8)));
}

async function main() {
  // 1) índice full-text (idempotente)
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS julgados_fts ON julgados USING GIN (to_tsvector('portuguese', "searchText"))`,
  );

  // 2) localizar os datasets de espelhos de acórdãos
  const search = await fetchJson(`${CKAN}/package_search?q=ac%C3%B3rd%C3%A3os&rows=30`);
  const packages = (search.result?.results ?? []).filter((p: any) =>
    /espelhos de ac/i.test(p.title ?? ''),
  );
  console.log(`datasets encontrados: ${packages.length}`);

  let total = 0;
  for (const pkg of packages) {
    const jsonRes = (pkg.resources ?? [])
      .filter((r: any) => (r.format ?? '').toUpperCase() === 'JSON' && /\d{8}\.json/i.test(r.url ?? ''))
      .sort((a: any, b: any) => (b.url > a.url ? 1 : -1))
      .slice(0, FILES_PER_DATASET);

    for (const res of jsonRes) {
      try {
        const arr = await fetchJson(res.url);
        const records: any[] = Array.isArray(arr) ? arr : [];
        const seenIds = new Set<string>();
        const batch = records
          .map((r) => {
            const ementa = String(r.ementa ?? '').trim();
            const sourceId = String(r.id ?? r.numeroRegistro ?? '');
            if (!ementa || !sourceId || seenIds.has(sourceId)) return null;
            seenIds.add(sourceId);
            const registro = String(r.numeroRegistro ?? r.id ?? '');
            return {
              source: 'STJ',
              sourceId,
              court: 'STJ',
              processNumber: r.numeroProcesso ? String(r.numeroProcesso) : null,
              classe: r.descricaoClasse ?? r.siglaClasse ?? null,
              orgaoJulgador: r.nomeOrgaoJulgador ?? null,
              relator: r.ministroRelator ?? null,
              publishedAt: parsePublicacao(r.dataPublicacao),
              decidedAt: parseDecisao(r.dataDecisao),
              ementa,
              tese: r.teseJuridica ? String(r.teseJuridica) : null,
              tema: r.tema ? String(r.tema) : null,
              url: registro
                ? `https://scon.stj.jus.br/SCON/pesquisar.jsp?livre=${encodeURIComponent(registro)}`
                : null,
              searchText: [r.ementa, r.teseJuridica, r.tema, r.descricaoClasse, r.ministroRelator]
                .filter(Boolean)
                .join(' \n '),
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);

        if (batch.length > 0) {
          const result = await prisma.julgado.createMany({ data: batch, skipDuplicates: true });
          total += result.count;
        }
        console.log(`  ${pkg.title} :: ${res.url.split('/').pop()} (+${batch.length})`);
      } catch (e) {
        console.log(`  falha em ${res.url}: ${(e as Error).message}`);
      }
    }
  }

  const count = await prisma.julgado.count();
  console.log(`\nIngeridos ~${total} registros. Total na base: ${count}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
