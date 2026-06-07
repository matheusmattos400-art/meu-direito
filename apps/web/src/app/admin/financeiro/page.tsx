'use client';

import { useEffect, useState } from 'react';
import { Badge, Card, CardContent, CardHeader, CardTitle, Spinner } from '@app/ui';
import { apiFetch } from '@/lib/api';

interface Finance {
  activeSubscriptions: number;
  mrr: number;
  totalPaid: number;
  byPlan: Array<{ plan: string; price: number; subscribers: number }>;
  payments: Array<{
    id: string;
    payer: string | null;
    amount: number;
    method: string;
    status: string;
    paidAt: string | null;
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

  useEffect(() => {
    apiFetch<Finance>('/admin/finance')
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner className="text-muted-foreground" />;
  if (error) return <p className="text-sm text-accent">{error}</p>;
  if (!data) return null;

  return (
    <div className="flex flex-col gap-10">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Receita</p>
        <h1 className="mt-1 font-serif text-4xl tracking-tightish">Financeiro</h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Receita recorrente (MRR)" value={brl(data.mrr)} accent />
        <Metric label="Assinaturas ativas" value={String(data.activeSubscriptions)} />
        <Metric label="Recebido (recente)" value={brl(data.totalPaid)} />
      </div>

      <Card>
        <CardContent className="pt-6">
          <h3 className="mb-4 font-serif text-lg tracking-tightish">Assinantes por plano</h3>
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
