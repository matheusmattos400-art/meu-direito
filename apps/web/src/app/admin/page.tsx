'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, Spinner } from '@app/ui';
import { apiFetch } from '@/lib/api';

interface Stats {
  newUsers30d: number;
  conversionRatePct: number;
  casesByStatus: Array<{ status: string; count: number }>;
  casesByCategory: Array<{ category: string; count: number }>;
  casesByCity: Array<{ city: string | null; state: string | null; count: number }>;
  support: {
    open: number;
    inProgress: number;
    resolved: number;
    avgResponseMinutes: number | null;
  };
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

  const totalCases = stats.casesByStatus.reduce((s, r) => s + r.count, 0);

  return (
    <div className="flex flex-col gap-10">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Visão geral</p>
        <h1 className="mt-1 font-serif text-4xl tracking-tightish">Painel</h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Novos cadastros" hint="últimos 30 dias" value={String(stats.newUsers30d)} />
        <Metric label="Casos triados" hint="total" value={String(totalCases)} />
        <Metric label="Taxa de conversão" hint="qualificados → atendidos" value={`${stats.conversionRatePct}%`} accent />
        <Metric
          label="Categorias ativas"
          hint="com casos"
          value={String(stats.casesByCategory.length)}
        />
      </div>

      <section>
        <h2 className="mb-3 font-serif text-lg tracking-tightish">Suporte</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Chamados abertos" value={String(stats.support.open)} accent={stats.support.open > 0} />
          <Metric label="Em andamento" value={String(stats.support.inProgress)} />
          <Metric label="Resolvidos" value={String(stats.support.resolved)} />
          <Metric
            label="Tempo médio de resposta"
            value={fmtMinutes(stats.support.avgResponseMinutes)}
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Distribution title="Casos por categoria" rows={stats.casesByCategory.map((r) => ({ label: r.category, count: r.count }))} />
        <Distribution title="Casos por status" rows={stats.casesByStatus.map((r) => ({ label: prettyStatus(r.status), count: r.count }))} />
      </div>

      <Distribution
        title="Distribuição por cidade"
        subtitle="Mapa de calor por município (granularidade minimizada — LGPD)"
        rows={stats.casesByCity.map((r) => ({
          label: `${r.city ?? '—'}${r.state ? `/${r.state}` : ''}`,
          count: r.count,
        }))}
        empty="Sem dados de localização ainda."
      />
    </div>
  );
}

function Metric({
  label,
  hint,
  value,
  accent,
}: {
  label: string;
  hint?: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="relative pt-6">
        <div
          className={`absolute inset-x-0 top-0 h-1 ${accent ? 'bg-accent' : 'bg-border'}`}
          aria-hidden
        />
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-3 font-serif text-4xl tracking-tightish tabular-nums">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function Distribution({
  title,
  subtitle,
  rows,
  empty,
}: {
  title: string;
  subtitle?: string;
  rows: Array<{ label: string; count: number }>;
  empty?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="font-serif text-lg tracking-tightish">{title}</h3>
        {subtitle && <p className="mb-4 mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        <div className="mt-4 flex flex-col gap-3.5">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{empty ?? 'Sem dados.'}</p>
          ) : (
            rows.map((r) => (
              <div key={r.label} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between text-sm">
                  <span>{r.label}</span>
                  <span className="tabular-nums text-muted-foreground">{r.count}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${(r.count / max) * 100}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function fmtMinutes(min: number | null): string {
  if (min === null) return '—';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

function prettyStatus(s: string): string {
  const map: Record<string, string> = {
    SUBMITTED: 'Enviado',
    TRIAGING: 'Em triagem',
    TRIAGED: 'Triado',
    RESOLVED_INFO: 'Dúvida resolvida',
    QUALIFIED: 'Qualificado',
    AVAILABLE: 'Disponível',
    ASSIGNED: 'Em atendimento',
    IN_PROGRESS: 'Em andamento',
    CLOSED: 'Encerrado',
    ARCHIVED: 'Arquivado',
  };
  return map[s] ?? s;
}
