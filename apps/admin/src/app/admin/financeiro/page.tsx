'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Spinner } from '@app/ui';
import { apiFetch } from '@/lib/api';

interface Finance {
  activeSubscriptions: number;
  lawyersActive: number;
  lawyersCanceled: number;
  mrr: number;
  totalPaid: number;
  byPlan: Array<{ plan: string; price: number; subscribers: number }>;
  lawyersByState: Array<{ state: string; count: number }>;
  payments: Array<{
    id: string;
    payer: string | null;
    amount: number;
    method: string;
    status: string;
    createdAt: string;
  }>;
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const PAYMENT_STATUS: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  PAID: { label: 'Pago', variant: 'success' },
  PENDING: { label: 'Pendente', variant: 'warning' },
  FAILED: { label: 'Falhou', variant: 'danger' },
  REFUNDED: { label: 'Estornado', variant: 'neutral' },
  CHARGEBACK: { label: 'Chargeback', variant: 'danger' },
};

export default function FinanceiroPage() {
  const [data, setData] = useState<Finance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPlanForm, setShowPlanForm] = useState(false);

  function load() {
    apiFetch<Finance>('/admin/finance')
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  if (loading) return <Spinner className="text-muted-foreground" />;
  if (error) return <p className="text-sm text-accent">{error}</p>;
  if (!data) return null;

  const maxState = Math.max(1, ...data.lawyersByState.map((s) => s.count));

  return (
    <div className="flex flex-col gap-10">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Receita</p>
          <h1 className="mt-1 font-serif text-4xl tracking-tightish">Financeiro</h1>
        </div>
        <Link href="/admin/financeiro/planilha">
          <Button size="sm" variant="outline">Abrir planilha de pagamentos</Button>
        </Link>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Receita recorrente (MRR)" value={brl(data.mrr)} accent />
        <Metric label="Assinaturas ativas" value={String(data.activeSubscriptions)} />
        <Metric label="Advogados ativos" value={String(data.lawyersActive)} />
        <Metric label="Advogados cancelados" value={String(data.lawyersCanceled)} />
      </div>

      <EvolutionCard />

      {/* Gráfico de barras por estado */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="mb-5 font-serif text-lg tracking-tightish">Advogados por estado</h3>
          {data.lawyersByState.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem advogados ainda.</p>
          ) : (
            <div className="flex items-end gap-4 overflow-x-auto pb-2" style={{ height: 200 }}>
              {data.lawyersByState.map((s) => (
                <div key={s.state} className="flex w-14 shrink-0 flex-col items-center gap-2">
                  <span className="text-xs tabular-nums text-muted-foreground">{s.count}</span>
                  <div
                    className="w-9 rounded-t-md bg-accent transition-all"
                    style={{ height: `${(s.count / maxState) * 150}px`, minHeight: 6 }}
                  />
                  <span className="text-xs font-medium">{s.state}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preço por área do Direito */}
      <AreaPricing />

      {/* Planos combo + criar novo */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Planos combo</CardTitle>
          <Button size="sm" onClick={() => setShowPlanForm((v) => !v)}>
            {showPlanForm ? 'Fechar' : '+ Novo plano'}
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {showPlanForm && <NewPlanForm onCreated={() => { setShowPlanForm(false); load(); }} />}
          <div className="flex flex-col gap-3">
            {data.byPlan.map((p) => (
              <div key={p.plan} className="flex items-center justify-between text-sm">
                <span>{p.plan}</span>
                <span className="text-muted-foreground">
                  {p.subscribers} assinante(s) · {brl(p.price)}/mês
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pagamentos recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {data.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pagamento registrado.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {data.payments.map((p) => {
                const st = PAYMENT_STATUS[p.status] ?? { label: p.status, variant: 'neutral' as const };
                return (
                  <div key={p.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate">{p.payer ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.method} · {new Date(p.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="tabular-nums">{brl(p.amount)}</span>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface Area {
  id: string;
  name: string;
  monthlyPriceBRL: number | null;
  billable: boolean;
}

function AreaPricing() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [savedId, setSavedId] = useState<string | null>(null);

  function load() {
    apiFetch<Area[]>('/admin/areas')
      .then((a) => {
        setAreas(a);
        setDraft(Object.fromEntries(a.map((x) => [x.id, x.monthlyPriceBRL?.toString() ?? ''])));
      })
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function save(id: string) {
    const priceBRL = Number(draft[id] || 0);
    await apiFetch(`/admin/areas/${id}/price`, {
      method: 'POST',
      body: JSON.stringify({ priceBRL, billable: priceBRL > 0 }),
    });
    setSavedId(id);
    setTimeout(() => setSavedId(null), 1500);
    load();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Áreas do Direito — preço mensal</CardTitle>
        <p className="text-sm text-muted-foreground">
          Defina o valor de cada área. O advogado monta o combo dele somando as áreas.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Spinner className="text-muted-foreground" />
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {areas.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-4 py-3">
                <span className="text-sm">{a.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">R$</span>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-9 w-28"
                    placeholder="0,00"
                    value={draft[a.id] ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, [a.id]: e.target.value }))}
                  />
                  <Button size="sm" variant="outline" onClick={() => save(a.id)}>
                    {savedId === a.id ? '✓' : 'Salvar'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NewPlanForm({ onCreated }: { onCreated: () => void }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [cases, setCases] = useState('');
  const [highlights, setHighlights] = useState('');
  const [areas, setAreas] = useState<Area[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Area[]>('/admin/areas').then(setAreas).catch(() => {});
  }, []);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Soma das áreas escolhidas (referência para o admin definir o preço do combo).
  const sum = areas.filter((a) => selected.has(a.id)).reduce((t, a) => t + (a.monthlyPriceBRL ?? 0), 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/admin/plans', {
        method: 'POST',
        body: JSON.stringify({
          code: code.toUpperCase(),
          name,
          priceBRL: Number(price),
          casesPerMonth: Number(cases || 0),
          areaIds: [...selected],
          highlights: highlights.split(',').map((h) => h.trim()).filter(Boolean),
        }),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar plano.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input placeholder="Código (ex.: EMPRESARIAL)" value={code} onChange={(e) => setCode(e.target.value)} required />
        <Input placeholder="Nome (ex.: Empresarial)" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input type="number" step="0.01" placeholder="Preço do combo (R$/mês)" value={price} onChange={(e) => setPrice(e.target.value)} required />
        <Input type="number" placeholder="Casos/mês (opcional)" value={cases} onChange={(e) => setCases(e.target.value)} />
      </div>
      <div>
        <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Áreas incluídas</p>
        <div className="flex flex-wrap gap-2">
          {areas.map((a) => (
            <button
              type="button"
              key={a.id}
              onClick={() => toggle(a.id)}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                selected.has(a.id) ? 'border-accent bg-accent/15 text-foreground' : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {a.name}
              {a.monthlyPriceBRL != null && <span className="ml-1 text-xs opacity-70">{brl(a.monthlyPriceBRL)}</span>}
            </button>
          ))}
        </div>
        {selected.size > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Soma avulsa das áreas: <span className="tabular-nums">{brl(sum)}</span> — defina o preço do combo (pode dar desconto).
          </p>
        )}
      </div>
      <Input placeholder="Destaques (separados por vírgula)" value={highlights} onChange={(e) => setHighlights(e.target.value)} />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? <Spinner /> : 'Criar combo'}
        </Button>
        {error && <p className="text-sm text-accent">{error}</p>}
      </div>
    </form>
  );
}

function ym(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

interface Evolution {
  months: Array<{ month: string; new: number; cumulative: number }>;
}

function EvolutionCard() {
  const now = new Date();
  const [from, setFrom] = useState(ym(new Date(now.getFullYear(), now.getMonth() - 5, 1)));
  const [to, setTo] = useState(ym(now));
  const [ev, setEv] = useState<Evolution | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch<Evolution>(`/admin/finance/evolution?from=${from}-01&to=${to}-01`)
      .then(setEv)
      .catch(() => setEv({ months: [] }))
      .finally(() => setLoading(false));
  }, [from, to]);

  const maxNew = Math.max(1, ...(ev?.months ?? []).map((m) => m.new));
  const totalCumulative = ev?.months.at(-1)?.cumulative ?? 0;

  function fmtMonth(m: string) {
    const parts = m.split('-');
    const y = parts[0] ?? '';
    const mo = Number(parts[1] ?? '1');
    const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return `${meses[mo - 1] ?? ''}/${y.slice(2)}`;
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="font-serif text-lg tracking-tightish">Evolução de advogados</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Novos por mês · total acumulado: <span className="text-foreground">{totalCumulative}</span>
            </p>
          </div>
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              De
              <Input type="month" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Até
              <Input type="month" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
            </label>
          </div>
        </div>

        {loading ? (
          <Spinner className="text-muted-foreground" />
        ) : !ev || ev.months.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados no período.</p>
        ) : (
          <div className="flex items-end gap-3 overflow-x-auto pb-2" style={{ height: 200 }}>
            {ev.months.map((m) => (
              <div key={m.month} className="flex w-16 shrink-0 flex-col items-center gap-2">
                <span className="text-xs tabular-nums text-muted-foreground">+{m.new}</span>
                <div
                  className="w-10 rounded-t-md bg-accent transition-all"
                  style={{ height: `${(m.new / maxNew) * 130}px`, minHeight: m.new > 0 ? 6 : 2 }}
                  title={`Acumulado: ${m.cumulative}`}
                />
                <span className="text-[11px] text-muted-foreground">{fmtMonth(m.month)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="relative pt-6">
        <div className={`absolute inset-x-0 top-0 h-1 ${accent ? 'bg-accent' : 'bg-border'}`} aria-hidden />
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-3 font-serif text-3xl tracking-tightish tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
