'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Spinner, cn } from '@app/ui';
import { apiFetch } from '@/lib/api';

interface Area {
  id: string;
  name: string;
  priceBRL: number;
}
interface BundlePlan {
  code: string;
  name: string;
  priceBRL: number;
  highlights: string[];
  areas: Array<{ id: string; name: string }>;
}
interface Catalog {
  areas: Area[];
  plans: BundlePlan[];
}
interface Subscription {
  id: string;
  status: string;
  planCode: string | null;
  currentPeriodEnd: string | null;
  monthlyTotalBRL: number | null;
  areas: Array<{ id: string; name: string; priceBRL: number }>;
  plan: { code: string; name: string } | null;
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function PlanosPage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [cat, s] = await Promise.all([
      apiFetch<Catalog>('/billing/catalog'),
      apiFetch<Subscription | null>('/billing/subscription'),
    ]);
    setCatalog(cat);
    setSub(s);
    if (s?.areas?.length) setSelected(new Set(s.areas.map((a) => a.id)));
  }, []);

  useEffect(() => {
    load()
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false));
  }, [load]);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const total = useMemo(
    () => (catalog?.areas ?? []).filter((a) => selected.has(a.id)).reduce((t, a) => t + a.priceBRL, 0),
    [catalog, selected],
  );

  async function subscribe(payload: { planCode?: string; areaIds?: string[] }) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/billing/subscribe', { method: 'POST', body: JSON.stringify({ ...payload, method: 'PIX' }) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao assinar.');
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!confirm('Cancelar sua assinatura? Você perde o acesso às áreas.')) return;
    setBusy(true);
    try {
      await apiFetch('/billing/cancel', { method: 'POST' });
      setSelected(new Set());
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner className="text-muted-foreground" />;
  if (error) return <p className="text-sm text-accent">{error}</p>;
  if (!catalog) return null;

  const active = !!sub && sub.status === 'ACTIVE';
  const changed =
    !sub ||
    selected.size !== (sub.areas?.length ?? 0) ||
    [...selected].some((id) => !sub.areas?.find((a) => a.id === id));

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b border-border/60 pb-6">
        <p className="text-xs uppercase tracking-[0.3em] text-accent/80">Assinatura</p>
        <h1 className="mt-2 font-serif text-3xl tracking-tightish sm:text-4xl">Meu plano</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Escolha um combo pronto ou monte o seu somando áreas. Você atende apenas os casos das áreas
          que assinar e pode trocar quando quiser.
        </p>
      </header>

      {active && sub && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Assinatura ativa</CardTitle>
            <Badge variant="success" dot>
              {sub.monthlyTotalBRL != null ? `${brl(sub.monthlyTotalBRL)}/mês` : 'ativa'}
            </Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex flex-wrap gap-2">
              {sub.areas.map((a) => (
                <span key={a.id} className="rounded-full border border-border px-3 py-1 text-xs">
                  {a.name}
                </span>
              ))}
            </div>
            <p className="text-muted-foreground">
              {sub.plan ? `Combo: ${sub.plan.name} · ` : 'Combo personalizado · '}
              Renova em{' '}
              {sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString('pt-BR') : '—'}
            </p>
            <Button size="sm" variant="outline" onClick={cancel} disabled={busy} className="self-start">
              Cancelar assinatura
            </Button>
          </CardContent>
        </Card>
      )}

      {catalog.plans.length > 0 && (
        <section>
          <h2 className="mb-3 font-serif text-lg tracking-tightish">Combos prontos</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.plans.map((p) => (
              <Card key={p.code} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  <p className="font-serif text-2xl tracking-tightish">
                    {brl(p.priceBRL)}
                    <span className="text-sm text-muted-foreground">/mês</span>
                  </p>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  <div className="flex flex-1 flex-wrap gap-1.5">
                    {p.areas.map((a) => (
                      <span key={a.id} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {a.name}
                      </span>
                    ))}
                  </div>
                  <Button size="sm" disabled={busy} onClick={() => subscribe({ planCode: p.code })}>
                    {sub?.plan?.code === p.code ? 'Plano atual' : 'Assinar este combo'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-serif text-lg tracking-tightish">Monte o seu combo</h2>
        {catalog.areas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma área disponível no momento.</p>
        ) : (
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              <div className="flex flex-wrap gap-2">
                {catalog.areas.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggle(a.id)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-sm transition-colors',
                      selected.has(a.id)
                        ? 'border-accent bg-accent/15 text-foreground'
                        : 'border-border text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {a.name} <span className="ml-1 text-xs opacity-70">{brl(a.priceBRL)}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-border pt-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total mensal</p>
                  <p className="font-serif text-2xl tracking-tightish tabular-nums">{brl(total)}</p>
                </div>
                <Button
                  disabled={busy || selected.size === 0 || !changed}
                  onClick={() => subscribe({ areaIds: [...selected] })}
                >
                  {busy ? <Spinner /> : active ? 'Atualizar meu combo' : 'Assinar'}
                </Button>
              </div>
              {active && !changed && (
                <p className="text-xs text-muted-foreground">Este já é o seu combo atual.</p>
              )}
            </CardContent>
          </Card>
        )}
        {error && <p className="mt-3 text-sm text-accent">{error}</p>}
      </section>
    </div>
  );
}
