'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Spinner, cn } from '@app/ui';
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

export default function FinanceiroPage() {
  const [data, setData] = useState<Finance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planTick, setPlanTick] = useState(0);

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
          {showPlanForm && (
            <NewPlanForm
              onCreated={() => {
                setShowPlanForm(false);
                setPlanTick((t) => t + 1);
                load();
              }}
            />
          )}
          <PlansList reloadKey={planTick} onChanged={load} subscribersByName={Object.fromEntries(data.byPlan.map((p) => [p.plan, p.subscribers]))} />
        </CardContent>
      </Card>

      <RevenueHistory />
    </div>
  );
}

interface SubArea {
  id: string;
  name: string;
  monthlyPriceBRL: number | null;
  billable: boolean;
}
interface Area {
  id: string;
  name: string;
  monthlyPriceBRL: number | null;
  billable: boolean;
  subcategories: SubArea[];
}

/** Resolve a seleção (áreas inteiras + sub-temas) em ids e soma de referência. */
function scopeSummary(areas: Area[], selectedAreas: Set<string>, selectedSubs: Set<string>) {
  let sum = 0;
  const areaIds: string[] = [];
  const subcategoryIds: string[] = [];
  for (const a of areas) {
    if (selectedAreas.has(a.id)) {
      areaIds.push(a.id);
      sum += a.subcategories.length
        ? a.subcategories.reduce((t, s) => t + (s.monthlyPriceBRL ?? 0), 0)
        : a.monthlyPriceBRL ?? 0;
    } else {
      for (const s of a.subcategories) {
        if (selectedSubs.has(s.id)) {
          subcategoryIds.push(s.id);
          sum += s.monthlyPriceBRL ?? 0;
        }
      }
    }
  }
  return { areaIds, subcategoryIds, sum };
}

/** Seletor hierárquico: marca a área inteira ou sub-temas específicos. */
function ScopeSelector({
  areas,
  selectedAreas,
  selectedSubs,
  onToggleArea,
  onToggleSub,
}: {
  areas: Area[];
  selectedAreas: Set<string>;
  selectedSubs: Set<string>;
  onToggleArea: (id: string) => void;
  onToggleSub: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {areas.map((a) => {
        const hasSub = a.subcategories.length > 0;
        const areaOn = selectedAreas.has(a.id);
        return (
          <div key={a.id} className="rounded-md border border-border p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={areaOn} onChange={() => onToggleArea(a.id)} />
              {a.name}{' '}
              {hasSub ? (
                <span className="text-xs font-normal text-muted-foreground">(área inteira — todos os sub-temas)</span>
              ) : (
                a.monthlyPriceBRL != null && (
                  <span className="text-xs font-normal text-muted-foreground">{brl(a.monthlyPriceBRL)}</span>
                )
              )}
            </label>
            {hasSub && (
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 border-l border-border pl-4">
                {a.subcategories.map((s) => (
                  <label
                    key={s.id}
                    className={cn('flex items-center gap-2 text-sm', areaOn && 'text-muted-foreground')}
                  >
                    <input
                      type="checkbox"
                      checked={areaOn || selectedSubs.has(s.id)}
                      disabled={areaOn}
                      onChange={() => onToggleSub(s.id)}
                    />
                    {s.name}
                    {s.monthlyPriceBRL != null && <span className="text-xs opacity-70">{brl(s.monthlyPriceBRL)}</span>}
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AreaPricing() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [newSub, setNewSub] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function load() {
    apiFetch<Area[]>('/admin/areas')
      .then((a) => {
        setAreas(a);
        const d: Record<string, string> = {};
        for (const x of a) {
          d[x.id] = x.monthlyPriceBRL?.toString() ?? '';
          for (const s of x.subcategories) d[s.id] = s.monthlyPriceBRL?.toString() ?? '';
        }
        setDraft(d);
      })
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function saveArea(id: string) {
    const priceBRL = Number(draft[id] || 0);
    await apiFetch(`/admin/areas/${id}/price`, { method: 'POST', body: JSON.stringify({ priceBRL, billable: priceBRL > 0 }) });
    load();
  }
  async function saveSub(id: string) {
    const priceBRL = Number(draft[id] || 0);
    await apiFetch(`/admin/subareas/${id}/price`, { method: 'POST', body: JSON.stringify({ priceBRL, billable: priceBRL > 0 }) });
    load();
  }
  async function addSub(areaId: string) {
    const name = (newSub[areaId] ?? '').trim();
    if (!name) return;
    setBusy(true);
    try {
      await apiFetch('/admin/subareas', { method: 'POST', body: JSON.stringify({ categoryId: areaId, name }) });
      setNewSub((n) => ({ ...n, [areaId]: '' }));
      load();
    } finally {
      setBusy(false);
    }
  }
  async function delSub(id: string) {
    if (!confirm('Remover este sub-tema?')) return;
    await apiFetch(`/admin/subareas/${id}`, { method: 'DELETE' });
    load();
  }
  function toggle(id: string) {
    setOpen((o) => {
      const n = new Set(o);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Áreas e sub-temas — preço mensal</CardTitle>
        <p className="text-sm text-muted-foreground">
          Áreas com sub-temas (ex.: Direito Cível → Família, Sucessões…) são precificadas por sub-tema.
          Expanda para gerenciar.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Spinner className="text-muted-foreground" />
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {areas.map((a) => {
              const hasSub = a.subcategories.length > 0;
              const subSum = a.subcategories.reduce((t, s) => t + (s.monthlyPriceBRL ?? 0), 0);
              return (
                <div key={a.id} className="py-3">
                  <div className="flex items-center justify-between gap-4">
                    {hasSub ? (
                      <button type="button" onClick={() => toggle(a.id)} className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">{open.has(a.id) ? '▾' : '▸'}</span>
                        {a.name}
                        <span className="text-xs text-muted-foreground">
                          ({a.subcategories.length} sub-temas · {brl(subSum)})
                        </span>
                      </button>
                    ) : (
                      <span className="text-sm">{a.name}</span>
                    )}
                    {!hasSub && (
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
                        <Button size="sm" variant="outline" onClick={() => saveArea(a.id)}>
                          Salvar
                        </Button>
                      </div>
                    )}
                  </div>
                  {hasSub && open.has(a.id) && (
                    <div className="mt-3 flex flex-col gap-2 border-l border-border pl-4">
                      {a.subcategories.map((s) => (
                        <div key={s.id} className="flex items-center justify-between gap-3">
                          <span className="text-sm text-muted-foreground">{s.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">R$</span>
                            <Input
                              type="number"
                              step="0.01"
                              className="h-8 w-24"
                              placeholder="0,00"
                              value={draft[s.id] ?? ''}
                              onChange={(e) => setDraft((d) => ({ ...d, [s.id]: e.target.value }))}
                            />
                            <Button size="sm" variant="outline" onClick={() => saveSub(s.id)}>
                              Salvar
                            </Button>
                            <button onClick={() => delSub(s.id)} className="text-xs text-muted-foreground hover:text-accent" title="Remover">
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className="flex items-center gap-2 pt-1">
                        <Input
                          className="h-8"
                          placeholder="Novo sub-tema (ex.: Família)"
                          value={newSub[a.id] ?? ''}
                          onChange={(e) => setNewSub((n) => ({ ...n, [a.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && addSub(a.id)}
                        />
                        <Button size="sm" disabled={busy} onClick={() => addSub(a.id)}>
                          + Sub-tema
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface PlanItem {
  id: string;
  code: string;
  name: string;
  priceBRL: number;
  casesPerMonth: number;
  active: boolean;
  highlights: string[];
  areas: Array<{ id: string; name: string }>;
  subcategories: Array<{ id: string; name: string }>;
}

function PlansList({
  reloadKey,
  onChanged,
  subscribersByName,
}: {
  reloadKey: number;
  onChanged: () => void;
  subscribersByName: Record<string, number>;
}) {
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    apiFetch<PlanItem[]>('/admin/plans').then(setPlans).catch(() => {});
  }
  useEffect(load, [reloadKey]);
  useEffect(() => {
    apiFetch<Area[]>('/admin/areas').then(setAreas).catch(() => {});
  }, []);

  async function remove(p: PlanItem) {
    if (!confirm(`Excluir o plano "${p.name}"? Esta ação não pode ser desfeita.`)) return;
    setBusy(true);
    try {
      await apiFetch(`/admin/plans/${p.id}`, { method: 'DELETE' });
      load();
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  if (plans.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum plano combo criado ainda.</p>;
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      {plans.map((p) =>
        editing === p.id ? (
          <PlanEditor
            key={p.id}
            plan={p}
            areas={areas}
            onDone={(changed) => {
              setEditing(null);
              if (changed) {
                load();
                onChanged();
              }
            }}
          />
        ) : (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {p.name} {!p.active && <span className="text-xs text-muted-foreground">(inativo)</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {brl(p.priceBRL)}/mês ·{' '}
                {[...p.areas.map((a) => a.name), ...p.subcategories.map((s) => s.name)].join(', ') || 'sem áreas'}
                {subscribersByName[p.name] != null ? ` · ${subscribersByName[p.name]} assinante(s)` : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(p.id)}>
                Editar
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => remove(p)} className="text-accent">
                Excluir
              </Button>
            </div>
          </div>
        ),
      )}
    </div>
  );
}

function PlanEditor({
  plan,
  areas,
  onDone,
}: {
  plan: PlanItem;
  areas: Area[];
  onDone: (changed: boolean) => void;
}) {
  const [name, setName] = useState(plan.name);
  const [price, setPrice] = useState(String(plan.priceBRL));
  const [cases, setCases] = useState(String(plan.casesPerMonth));
  const [active, setActive] = useState(plan.active);
  const [selAreas, setSelAreas] = useState<Set<string>>(new Set(plan.areas.map((a) => a.id)));
  const [selSubs, setSelSubs] = useState<Set<string>>(new Set(plan.subcategories.map((s) => s.id)));
  const [busy, setBusy] = useState(false);

  const toggleArea = (id: string) =>
    setSelAreas((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const toggleSub = (id: string) =>
    setSelSubs((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const { areaIds, subcategoryIds, sum } = scopeSummary(areas, selAreas, selSubs);

  async function save() {
    setBusy(true);
    try {
      await apiFetch(`/admin/plans/${plan.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          priceBRL: Number(price),
          casesPerMonth: Number(cases || 0),
          areaIds,
          subcategoryIds,
          active,
        }),
      });
      onDone(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" />
        <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Preço/mês" />
        <Input type="number" value={cases} onChange={(e) => setCases(e.target.value)} placeholder="Casos/mês" />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Plano ativo
        </label>
      </div>
      <ScopeSelector areas={areas} selectedAreas={selAreas} selectedSubs={selSubs} onToggleArea={toggleArea} onToggleSub={toggleSub} />
      <p className="text-xs text-muted-foreground">
        Soma avulsa: <span className="tabular-nums">{brl(sum)}</span>
      </p>
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={save}>
          {busy ? <Spinner /> : 'Salvar'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => onDone(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

interface DayPayments {
  date: string;
  total: number;
  count: number;
  payments: Array<{ id: string; payer: string | null; amount: number; method: string; paidAt: string | null }>;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function RevenueHistory() {
  const [date, setDate] = useState(todayISO());
  const [data, setData] = useState<DayPayments | null>(null);
  const [busy, setBusy] = useState(false);

  function load(d: string) {
    setBusy(true);
    apiFetch<DayPayments>(`/admin/finance/payments?date=${d}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setBusy(false));
  }
  useEffect(() => {
    load(date);
  }, [date]);

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base">Histórico de receita</CardTitle>
          <p className="text-sm text-muted-foreground">Somente o que entrou (pagamentos recebidos) no dia.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-40" />
          <Button size="sm" variant="outline" disabled={busy} onClick={() => load(date)} title="Atualizar o dia selecionado">
            {busy ? <Spinner /> : '↻ Atualizar'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!data ? (
          <Spinner className="text-muted-foreground" />
        ) : data.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma receita em {new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR')}.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              Total do dia:{' '}
              <span className="font-serif text-xl tracking-tightish text-emerald-400">{brl(data.total)}</span>{' '}
              <span className="text-muted-foreground">({data.count} pagamento(s))</span>
            </p>
            <div className="flex flex-col divide-y divide-border">
              {data.payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate">{p.payer ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.method}
                      {p.paidAt ? ` · ${new Date(p.paidAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}
                    </p>
                  </div>
                  <span className="tabular-nums text-emerald-400">+ {brl(p.amount)}</span>
                </div>
              ))}
            </div>
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
  const [selAreas, setSelAreas] = useState<Set<string>>(new Set());
  const [selSubs, setSelSubs] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Area[]>('/admin/areas').then(setAreas).catch(() => {});
  }, []);

  const toggleArea = (id: string) =>
    setSelAreas((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const toggleSub = (id: string) =>
    setSelSubs((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const { areaIds, subcategoryIds, sum } = scopeSummary(areas, selAreas, selSubs);
  const hasScope = areaIds.length + subcategoryIds.length > 0;

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
          areaIds,
          subcategoryIds,
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
        <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Áreas e sub-temas incluídos</p>
        <ScopeSelector areas={areas} selectedAreas={selAreas} selectedSubs={selSubs} onToggleArea={toggleArea} onToggleSub={toggleSub} />
        {hasScope && (
          <p className="mt-2 text-xs text-muted-foreground">
            Soma avulsa: <span className="tabular-nums">{brl(sum)}</span> — defina o preço do combo (pode dar desconto).
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
