'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Card, CardContent, Input, Spinner } from '@app/ui';
import { apiFetch } from '@/lib/api';

interface Movement {
  rawText: string;
  simplifiedText: string;
  occurredAt: string | null;
}
interface Preview {
  processNumber: string;
  court: string | null;
  className: string | null;
  subject: string | null;
  movements: Movement[];
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

export default function AdvogadoDashboard() {
  const [counts, setCounts] = useState<Record<string, number | undefined>>({});
  const trackRef = useRef<HTMLDivElement>(null);

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
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Workspace</p>
          <h1 className="mt-1 font-serif text-4xl tracking-tightish">Seu painel</h1>
        </div>
        <div className="hidden gap-2 sm:flex">
          <button onClick={() => scroll(-1)} className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Anterior">‹</button>
          <button onClick={() => scroll(1)} className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Próximo">›</button>
        </div>
      </header>

      {/* Carrossel de informações principais */}
      <div
        ref={trackRef}
        className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {CARDS.map((card) => (
          <Link key={card.key} href={card.href} className="min-w-[260px] snap-start sm:min-w-[300px]">
            <Card className="group h-full overflow-hidden transition-colors hover:border-ring">
              <CardContent className="relative flex h-full flex-col justify-between gap-6 pt-6">
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-accent/5 transition-colors group-hover:bg-accent/10" aria-hidden />
                <div className="flex items-start justify-between">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
                    <path d={card.icon} />
                  </svg>
                  <span className="text-2xl text-muted-foreground transition-transform group-hover:translate-x-1">→</span>
                </div>
                <div>
                  <p className="font-serif text-5xl tracking-tightish tabular-nums">
                    {counts[card.key] === undefined ? '—' : counts[card.key]}
                  </p>
                  <p className="mt-2 font-medium">{card.title}</p>
                  <p className="text-sm text-muted-foreground">{card.subtitle}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Consulta Datajud */}
      <DatajudConsult />
    </div>
  );
}

function DatajudConsult() {
  const [number, setNumber] = useState('');
  const [court, setCourt] = useState('');
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
    setConfirmClear(false);
    setError(null);
  }

  async function saveFollow() {
    if (!result) return;
    setSaving(true);
    try {
      await apiFetch('/processos', {
        method: 'POST',
        body: JSON.stringify({ processNumber: result.processNumber, court: result.court ?? undefined }),
      });
      reset();
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

      {result && (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-mono text-sm">{result.processNumber}</p>
                <p className="text-sm text-muted-foreground">
                  {[result.className, result.subject, result.court].filter(Boolean).join(' · ') || 'Processo localizado'}
                </p>
              </div>
              <Badge variant="neutral">{result.movements.length} movimento(s)</Badge>
            </div>

            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Últimos andamentos</p>
              <ol className="relative flex flex-col gap-4 border-l border-border pl-4">
                {result.movements.slice(0, 6).map((m, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-accent" aria-hidden />
                    <p className="text-sm">{m.simplifiedText || m.rawText}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.occurredAt ? new Date(m.occurredAt).toLocaleDateString('pt-BR') : '—'}
                    </p>
                  </li>
                ))}
                {result.movements.length === 0 && (
                  <li className="text-sm text-muted-foreground">Sem movimentos retornados.</li>
                )}
              </ol>
            </div>

            <Button onClick={saveFollow} disabled={saving} className="self-start">
              {saving ? <Spinner /> : 'Salvar para acompanhar'}
            </Button>
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
