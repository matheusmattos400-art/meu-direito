'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Avatar, Badge, Card, CardContent, Input, Spinner } from '@app/ui';
import { apiFetch } from '@/lib/api';

interface Row {
  lawyerId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  planCode: string | null;
  payment: 'EM_DIA' | 'VENCIDO' | 'SEM_PLANO';
  casesThisMonth: number;
  accountStatus: string;
}

const PAYMENT: Record<Row['payment'], { label: string; variant: 'success' | 'danger' | 'neutral' }> = {
  EM_DIA: { label: 'Em dia', variant: 'success' },
  VENCIDO: { label: 'Vencido', variant: 'danger' },
  SEM_PLANO: { label: 'Sem plano', variant: 'neutral' },
};

const FILTERS: Array<{ key: 'ALL' | Row['payment']; label: string }> = [
  { key: 'ALL', label: 'Todos' },
  { key: 'EM_DIA', label: 'Em dia' },
  { key: 'VENCIDO', label: 'Vencidos' },
  { key: 'SEM_PLANO', label: 'Sem plano' },
];

export default function PlanilhaPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'ALL' | Row['payment']>('ALL');

  useEffect(() => {
    apiFetch<Row[]>('/admin/finance/sheet')
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      const okFilter = filter === 'ALL' || r.payment === filter;
      const okTerm = !term || (r.name ?? '').toLowerCase().includes(term) || (r.email ?? '').toLowerCase().includes(term);
      return okFilter && okTerm;
    });
  }, [rows, q, filter]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/financeiro" className="text-sm text-muted-foreground hover:text-foreground">
          ← Financeiro
        </Link>
        <h1 className="mt-2 font-serif text-3xl tracking-tightish">Planilha de pagamentos</h1>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Pesquisar por nome ou e-mail..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                filter === f.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Spinner className="text-muted-foreground" />
      ) : error ? (
        <p className="text-sm text-accent">{error}</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Advogado</th>
                    <th className="px-4 py-3 font-medium">Contato</th>
                    <th className="px-4 py-3 font-medium">Plano</th>
                    <th className="px-4 py-3 text-center font-medium">Casos no mês</th>
                    <th className="px-4 py-3 font-medium">Pagamento</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        Nenhum resultado.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r) => {
                      const pay = PAYMENT[r.payment];
                      return (
                        <tr key={r.lawyerId} className="border-b border-border last:border-0">
                          <td className="px-4 py-3">
                            <Link href={`/admin/advogados/${r.lawyerId}`} className="flex items-center gap-3 hover:underline">
                              <Avatar src={r.avatarUrl} name={r.name} size="sm" />
                              <span>{r.name ?? '—'}</span>
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            <div>{r.email ?? '—'}</div>
                            <div className="text-xs">{r.phone ?? '—'}</div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{r.planCode ?? '—'}</td>
                          <td className="px-4 py-3 text-center tabular-nums">{r.casesThisMonth}</td>
                          <td className="px-4 py-3">
                            <Badge variant={pay.variant} dot>
                              {pay.label}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
