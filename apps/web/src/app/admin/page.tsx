'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Spinner } from '@app/ui';
import { apiFetch } from '@/lib/api';

interface Stats {
  newUsers30d: number;
  conversionRatePct: number;
  casesByStatus: Array<{ status: string; count: number }>;
  casesByCategory: Array<{ category: string; count: number }>;
  casesByCity: Array<{ city: string | null; state: string | null; count: number }>;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Stats>('/admin/stats')
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar métricas.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner className="text-muted-foreground" />;
  if (error) return <p className="text-sm text-accent">{error}</p>;
  if (!stats) return null;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-serif text-3xl tracking-tightish">Painel</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <Metric label="Novos cadastros (30 dias)" value={String(stats.newUsers30d)} />
        <Metric label="Taxa de conversão" value={`${stats.conversionRatePct}%`} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DistributionCard title="Casos por categoria" rows={stats.casesByCategory.map((r) => ({ label: r.category, count: r.count }))} />
        <DistributionCard title="Casos por status" rows={stats.casesByStatus.map((r) => ({ label: r.status, count: r.count }))} />
      </div>

      <DistributionCard
        title="Casos por cidade"
        rows={stats.casesByCity.map((r) => ({
          label: `${r.city ?? '—'}${r.state ? `/${r.state}` : ''}`,
          count: r.count,
        }))}
        empty="Sem dados de localização ainda."
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-2 font-serif text-4xl tracking-tightish">{value}</p>
      </CardContent>
    </Card>
  );
}

function DistributionCard({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Array<{ label: string; count: number }>;
  empty?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty ?? 'Sem dados.'}</p>
        ) : (
          rows.map((r) => (
            <div key={r.label} className="flex flex-col gap-1">
              <div className="flex justify-between text-sm">
                <span>{r.label}</span>
                <span className="text-muted-foreground">{r.count}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted">
                <div
                  className="h-1.5 rounded-full bg-accent"
                  style={{ width: `${(r.count / max) * 100}%` }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
