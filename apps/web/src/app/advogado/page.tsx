'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Card, CardContent, Input, Spinner } from '@app/ui';
import { apiFetch } from '@/lib/api';
import { useMe } from '@/lib/use-me';

interface Movement {
  rawText: string;
  explanation: string;
  occurredAt: string | null;
}
interface Preview {
  processNumber: string;
  court: string | null;
  orgaoJulgador: string | null;
  className: string | null;
  subject: string | null;
  movements: Movement[];
  demo: boolean;
  found: boolean;
}

const CARDS = [
  {
    key: 'clientes',
    title: 'Processos',
    subtitle: 'Seus clientes e processos ativos',
    href: '/advogado/casos',
    icon: 'M3 7h18M3 12h18M3 17h18',
  },
  {
    key: 'chamadas',
    title: 'Chamadas',
    subtitle: 'Novos clientes para você contatar',
    href: '/advogado/oportunidades',
    icon: 'M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z',
  },
  {
    key: 'processos',
    title: 'Repositório',
    subtitle: 'Todos os processos e prazos',
    href: '/advogado/processos',
    icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6',
  },
  {
    key: 'receitas',
    title: 'Minhas receitas',
    subtitle: 'Controle suas despesas e ganhos',
    href: '/advogado/receitas',
    icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
  },
] as const;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function firstName(full?: string | null): string {
  if (!full) return 'Advogado(a)';
  const parts = full.trim().split(/\s+/);
  // mantém prefixo "Dr."/"Dra." + primeiro nome
  if (/^dr?a?\.?$/i.test(parts[0] ?? '')) return `${parts[0]} ${parts[1] ?? ''}`.trim();
  return parts[0] ?? full;
}

export default function AdvogadoDashboard() {
  const { me } = useMe();
  const [counts, setCounts] = useState<Record<string, number | undefined>>({});
  const [savedTick, setSavedTick] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  useEffect(() => {
    apiFetch<unknown[]>('/opportunities')
      .then((o) => setCounts((c) => ({ ...c, chamadas: o.length })))
      .catch(() => {});
    apiFetch<unknown[]>('/processos')
      .then((p) => setCounts((c) => ({ ...c, processos: p.length })))
      .catch(() => {});
    apiFetch<{ stages?: Array<{ cards?: unknown[] }> }>('/workspace/board')
      .then((b) => {
        const n = (b.stages ?? []).reduce((t, s) => t + (s.cards?.length ?? 0), 0);
        setCounts((c) => ({ ...c, clientes: n }));
      })
      .catch(() => {});
  }, []);

  function scroll(dir: 1 | -1) {
    const el = trackRef.current;
    if (el) el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.8, 360), behavior: 'smooth' });
  }

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border/60 pb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-accent/80">{today}</p>
          <h1 className="mt-2 font-serif text-4xl leading-tight tracking-tightish sm:text-5xl">
            {greeting()}, <span className="text-accent">{firstName(me?.fullName)}</span>.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Aqui está o panorama do seu escritório hoje.
          </p>
        </div>
        <div className="hidden gap-2 sm:flex">
          <button onClick={() => scroll(-1)} className="grid h-10 w-10 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground" aria-label="Anterior">‹</button>
          <button onClick={() => scroll(1)} className="grid h-10 w-10 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground" aria-label="Próximo">›</button>
        </div>
      </header>

      {/* Carrossel de informações principais */}
      <div
        ref={trackRef}
        className="-mx-1 flex snap-x snap-mandatory gap-5 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {CARDS.map((card) => (
          <Link key={card.key} href={card.href} className="group min-w-[250px] snap-start sm:min-w-[280px]">
            <Card className="h-full border-border/60 bg-card/70 backdrop-blur-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:border-accent/40 group-hover:shadow-[0_18px_40px_-24px_hsl(41_60%_58%/0.45)]">
              <CardContent className="flex h-full flex-col gap-8 pt-7">
                <div className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-full border border-accent/25 bg-accent/10 text-accent">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d={card.icon} />
                    </svg>
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{card.title}</span>
                </div>
                <div className="mt-auto">
                  <p className="font-serif text-5xl tracking-tightish tabular-nums text-accent">
                    {counts[card.key] === undefined ? '·' : counts[card.key]}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{card.subtitle}</p>
                </div>
                <span className="text-sm text-muted-foreground transition-colors group-hover:text-foreground">
                  Abrir <span className="transition-transform group-hover:translate-x-0.5">→</span>
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Consulta Datajud */}
      <DatajudConsult onSaved={() => setSavedTick((t) => t + 1)} />

      {/* Processos em acompanhamento (salvos) */}
      <FollowedProcesses reloadKey={savedTick} />
    </div>
  );
}

interface Followed {
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

function FollowedProcesses({ reloadKey }: { reloadKey: number }) {
  const [items, setItems] = useState<Followed[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [flash, setFlash] = useState<Record<string, string>>({});

  function load() {
    apiFetch<Followed[]>('/processos')
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }
  useEffect(load, [reloadKey]);

  async function update(id: string) {
    setSyncing(id);
    try {
      const r = await apiFetch<{ added: number }>(`/processos/${id}/sync`, { method: 'POST' });
      setFlash((f) => ({ ...f, [id]: r.added > 0 ? `${r.added} nova(s) movimentação(ões)` : 'Sem novidades' }));
      setTimeout(() => setFlash((f) => ({ ...f, [id]: '' })), 2500);
      load();
    } finally {
      setSyncing(null);
    }
  }

  if (loading || items.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-serif text-xl tracking-tightish">Acompanhando</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((p) => (
          <Card key={p.id}>
            <CardContent className="flex flex-col gap-3 pt-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {p.partyName && <p className="truncate font-medium">{p.partyName}</p>}
                  <p className="font-mono text-xs text-muted-foreground">{p.processNumber}</p>
                </div>
                <button
                  onClick={() => update(p.id)}
                  disabled={syncing === p.id}
                  className="shrink-0 rounded-full border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="Atualizar (buscar novas movimentações)"
                  aria-label="Atualizar"
                >
                  {syncing === p.id ? <Spinner /> : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 2v6h-6M3 12a9 9 0 0115-6.7L21 8M3 22v-6h6M21 12a9 9 0 01-15 6.7L3 16" />
                    </svg>
                  )}
                </button>
              </div>

              <div className="text-sm text-muted-foreground">
                {[p.className, p.subject].filter(Boolean).join(' · ') || 'Processo'}
                {p.orgaoJulgador && <span className="block">Vara: {p.orgaoJulgador}{p.court ? ` · ${p.court}` : ''}</span>}
              </div>

              <div className="rounded-md border border-border bg-muted/30 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Último andamento</p>
                {p.lastMovement ? (
                  <>
                    <p className="mt-1 text-sm font-medium">{p.lastMovement.rawText}</p>
                    <p className="text-sm text-muted-foreground">{p.lastMovement.text}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {p.lastMovement.occurredAt ? new Date(p.lastMovement.occurredAt).toLocaleDateString('pt-BR') : '—'}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">Aguardando sincronização.</p>
                )}
              </div>

              {flash[p.id] && <p className="text-xs text-accent">{flash[p.id]}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function DatajudConsult({ onSaved }: { onSaved: () => void }) {
  const [number, setNumber] = useState('');
  const [court, setCourt] = useState('');
  const [party, setParty] = useState('');
  const [result, setResult] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  async function consult(e: React.FormEvent) {
    e.preventDefault();
    if (!number.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const qs = new URLSearchParams({ number: number.trim() });
      if (court.trim()) qs.set('court', court.trim());
      setResult(await apiFetch<Preview>(`/processos/preview?${qs.toString()}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível consultar o processo.');
    } finally {
      setBusy(false);
    }
  }

  function requestClear() {
    if (result) setConfirmClear(true);
    else reset();
  }
  function reset() {
    setResult(null);
    setNumber('');
    setCourt('');
    setParty('');
    setConfirmClear(false);
    setError(null);
  }

  async function saveFollow() {
    if (!result) return;
    setSaving(true);
    try {
      await apiFetch('/processos', {
        method: 'POST',
        body: JSON.stringify({
          processNumber: result.processNumber,
          court: result.court ?? undefined,
          partyName: party.trim() || undefined,
        }),
      });
      reset();
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar acompanhamento.');
      setConfirmClear(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="font-serif text-xl tracking-tightish">Consultar processo</h2>
        <p className="text-sm text-muted-foreground">
          Pesquise pelo número (Datajud). Você pode salvar para acompanhar ou descartar.
        </p>
      </div>

      <form onSubmit={consult} className="flex flex-wrap items-center gap-2">
        <Input
          className="min-w-[260px] flex-1"
          placeholder="Número do processo (CNJ)"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
        />
        <Input className="w-28" placeholder="Tribunal" value={court} onChange={(e) => setCourt(e.target.value)} />
        <Button type="submit" disabled={busy}>
          {busy ? <Spinner /> : 'Consultar'}
        </Button>
        {(result || number) && (
          <Button type="button" variant="outline" onClick={requestClear} aria-label="Limpar busca">
            ✕ Limpar
          </Button>
        )}
      </form>

      {error && <p className="text-sm text-accent">{error}</p>}

      {result && result.demo && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          ⚠️ <strong>Modo demonstração:</strong> a consulta ao Datajud ainda não está conectada (falta a
          chave da API pública do CNJ). Os dados abaixo são de <strong>exemplo</strong>, não do processo real.
        </div>
      )}

      {result && !result.demo && !result.found && (
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Nenhum processo encontrado para este número no Datajud. Confira o número (20 dígitos) e o tribunal.
        </div>
      )}

      {result && (result.demo || result.found) && (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-mono text-sm">{result.processNumber}</p>
                <p className="text-sm text-muted-foreground">
                  {[result.className, result.subject, result.court].filter(Boolean).join(' · ') || 'Processo localizado'}
                </p>
                {result.orgaoJulgador && (
                  <p className="text-xs text-muted-foreground">Vara: {result.orgaoJulgador}</p>
                )}
              </div>
              <Badge variant="neutral">{result.movements.length} movimento(s)</Badge>
            </div>

            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Últimos andamentos</p>
              <ol className="relative flex flex-col gap-4 border-l border-border pl-4">
                {result.movements.slice(0, 8).map((m, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-accent" aria-hidden />
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className="text-sm font-medium">{m.rawText}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.occurredAt ? new Date(m.occurredAt).toLocaleDateString('pt-BR') : '—'}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">{m.explanation}</p>
                  </li>
                ))}
                {result.movements.length === 0 && (
                  <li className="text-sm text-muted-foreground">Sem movimentos retornados.</li>
                )}
              </ol>
            </div>

            <p className="text-xs text-muted-foreground">
              Fonte: Datajud/CNJ (base oficial). Reúne todas as instâncias (1º e 2º graus). Pode haver
              pequena defasagem em relação a agregadores privados.
            </p>

            <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Nome da parte / cliente (opcional)</label>
                <Input value={party} onChange={(e) => setParty(e.target.value)} placeholder="Ex.: João da Silva" className="w-64" />
              </div>
              <Button onClick={saveFollow} disabled={saving}>
                {saving ? <Spinner /> : 'Salvar para acompanhar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmação ao limpar com resultado na tela */}
      {confirmClear && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal>
          <Card className="w-full max-w-sm">
            <CardContent className="flex flex-col gap-4 pt-6">
              <div>
                <p className="font-medium">Salvar este processo?</p>
                <p className="text-sm text-muted-foreground">
                  Deseja salvar para continuar acompanhando ou descartar a consulta?
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={reset} disabled={saving}>
                  Descartar
                </Button>
                <Button onClick={saveFollow} disabled={saving}>
                  {saving ? <Spinner /> : 'Salvar acompanhamento'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}
