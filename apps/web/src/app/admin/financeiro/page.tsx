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

      {/* Planos + criar novo */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Planos</CardTitle>
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

function NewPlanForm({ onCreated }: { onCreated: () => void }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [cases, setCases] = useState('');
  const [areas, setAreas] = useState('');
  const [highlights, setHighlights] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          areas: Number(areas || 1),
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
    <form onSubmit={submit} className="grid gap-3 rounded-lg border border-border bg-muted/40 p-4 sm:grid-cols-2">
      <Input placeholder="Código (ex.: PREMIUM)" value={code} onChange={(e) => setCode(e.target.value)} required />
      <Input placeholder="Nome (ex.: Premium)" value={name} onChange={(e) => setName(e.target.value)} required />
      <Input type="number" step="0.01" placeholder="Preço mensal (R$)" value={price} onChange={(e) => setPrice(e.target.value)} required />
      <Input type="number" placeholder="Casos/mês" value={cases} onChange={(e) => setCases(e.target.value)} />
      <Input type="number" placeholder="Áreas de atuação" value={areas} onChange={(e) => setAreas(e.target.value)} />
      <Input placeholder="Destaques (separados por vírgula)" value={highlights} onChange={(e) => setHighlights(e.target.value)} />
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? <Spinner /> : 'Criar plano'}
        </Button>
        {error && <p className="text-sm text-accent">{error}</p>}
      </div>
    </form>
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
