'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Spinner,
} from '@app/ui';
import { apiFetch } from '@/lib/api';

interface Plan {
  code: string;
  name: string;
  priceBRL: number;
  casesPerMonth: number;
  areas: number;
  highlights: string[];
}
interface Subscription {
  id: string;
  planCode: string;
  status: string;
  currentPeriodEnd: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  TRIALING: 'Em teste',
  ACTIVE: 'Ativa',
  PAST_DUE: 'Pagamento pendente',
  CANCELED: 'Cancelada',
  EXPIRED: 'Expirada',
};

function brl(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function PlanosPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    Promise.all([
      apiFetch<Plan[]>('/billing/plans'),
      apiFetch<Subscription | null>('/billing/subscription'),
    ])
      .then(([p, s]) => {
        setPlans(p);
        setSub(s);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function subscribe(planCode: string) {
    setBusy(planCode);
    setError(null);
    try {
      await apiFetch('/billing/subscribe', {
        method: 'POST',
        body: JSON.stringify({ planCode, method: 'PIX' }),
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao assinar.');
    } finally {
      setBusy(null);
    }
  }

  async function cancel() {
    setBusy('cancel');
    try {
      await apiFetch('/billing/cancel', { method: 'POST' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cancelar.');
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <Spinner className="text-muted-foreground" />;

  const activeCode = sub?.status === 'ACTIVE' ? sub.planCode : null;

  return (
    <div>
      <h1 className="mb-2 font-serif text-3xl tracking-tightish">Planos</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Assinatura mensal por área de atuação e volume de casos triados.
      </p>

      {sub && (
        <Card className="mb-8">
          <CardContent className="flex items-center justify-between py-4">
            <div className="text-sm">
              <span className="text-muted-foreground">Assinatura atual: </span>
              <span className="font-medium">{sub.planCode}</span>
              <span className="text-muted-foreground"> · {STATUS_LABEL[sub.status] ?? sub.status}</span>
            </div>
            {sub.status === 'ACTIVE' && (
              <Button size="sm" variant="outline" onClick={cancel} disabled={busy === 'cancel'}>
                Cancelar
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => (
          <Card key={p.code} className={activeCode === p.code ? 'border-ring' : ''}>
            <CardHeader>
              <CardTitle className="text-base">{p.name}</CardTitle>
              <p className="font-serif text-3xl tracking-tightish">
                {brl(p.priceBRL)}
                <span className="text-sm text-muted-foreground">/mês</span>
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                {p.highlights.map((h) => (
                  <li key={h}>· {h}</li>
                ))}
              </ul>
              <Button
                size="sm"
                disabled={busy === p.code || activeCode === p.code}
                variant={activeCode === p.code ? 'outline' : 'primary'}
                onClick={() => subscribe(p.code)}
              >
                {activeCode === p.code ? 'Plano atual' : busy === p.code ? <Spinner /> : 'Assinar'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      {error && <p className="mt-4 text-sm text-accent">{error}</p>}
    </div>
  );
}
