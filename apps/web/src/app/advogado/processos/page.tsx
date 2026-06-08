'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge, Card, CardContent, Input, Spinner } from '@app/ui';
import { apiFetch } from '@/lib/api';

interface Processo {
  id: string;
  processNumber: string;
  court: string | null;
  orgaoJulgador: string | null;
  partyName: string | null;
  className: string | null;
  subject: string | null;
  lastSyncedAt: string | null;
  lastMovement: { text: string; rawText: string; occurredAt: string | null } | null;
}

export default function ProcessosPage() {
  const [items, setItems] = useState<Processo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    apiFetch<Processo[]>('/processos')
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter((p) =>
      [p.processNumber, p.partyName, p.className, p.subject, p.court, p.orgaoJulgador].some((v) =>
        (v ?? '').toLowerCase().includes(t),
      ),
    );
  }, [items, q]);

  return (
    <div className="flex flex-col gap-6">
      <header className="border-b border-border/60 pb-6">
        <p className="text-xs uppercase tracking-[0.3em] text-accent/80">Acervo</p>
        <h1 className="mt-2 font-serif text-3xl tracking-tightish sm:text-4xl">Processos</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Todos os processos acompanhados. Pesquise por parte, número, assunto ou vara.
        </p>
      </header>

      <Input
        placeholder="🔎 Pesquisar por número do processo, nome ou CPF..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="sm:max-w-md"
      />

      {loading ? (
        <Spinner className="text-muted-foreground" />
      ) : error ? (
        <p className="text-sm text-accent">{error}</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum processo {q ? 'encontrado' : 'acompanhado ainda'}. Use a busca Datajud no painel para
            salvar um processo, ou gere uma petição inicial a partir de uma chamada.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((p) => (
            <Card key={p.id} className="border-border/60 bg-card/70 transition-colors hover:border-accent/40">
              <CardContent className="flex flex-col gap-2 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    {p.partyName && <p className="font-medium">{p.partyName}</p>}
                    <p className="font-mono text-xs text-muted-foreground">{p.processNumber}</p>
                    <p className="text-sm text-muted-foreground">
                      {[p.className, p.subject].filter(Boolean).join(' · ') || 'Processo'}
                      {p.orgaoJulgador ? ` · ${p.orgaoJulgador}` : ''}
                      {p.court ? ` · ${p.court}` : ''}
                    </p>
                  </div>
                  <Badge variant="success" dot>Em acompanhamento</Badge>
                </div>
                {p.lastMovement && (
                  <div className="rounded-md border border-border bg-muted/30 p-2.5 text-sm">
                    <span className="font-medium">{p.lastMovement.rawText}</span>
                    <span className="text-muted-foreground"> — {p.lastMovement.text} </span>
                    <span className="text-xs text-muted-foreground">
                      ({p.lastMovement.occurredAt ? new Date(p.lastMovement.occurredAt).toLocaleDateString('pt-BR') : '—'})
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
