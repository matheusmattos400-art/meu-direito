'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, Spinner } from '@app/ui';
import { apiFetch } from '@/lib/api';
import { useMe } from '@/lib/use-me';

interface Stats {
  newUsers30d: number;
  conversionRatePct: number;
  casesByStatus: Array<{ status: string; count: number }>;
  overview: {
    lawyersActive: number;
    lawyersPending: number;
    citizens: number;
    supportOpen: number;
    activeSubscriptions: number;
    mrr: number | null;
  };
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function AdminDashboard() {
  const { me } = useMe();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Stats>('/admin/stats')
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner className="text-muted-foreground" />;
  if (error) return <p className="text-sm text-accent">{error}</p>;
  if (!stats) return null;

  const can = (scope: string) => !!me && (me.isOwner || me.adminScopes.includes(scope));
  const o = stats.overview;
  const totalCases = stats.casesByStatus.reduce((s, r) => s + r.count, 0);

  const hub = [
    { scope: 'ADVOGADOS', href: '/admin/advogados', label: 'Advogados ativos', value: String(o.lawyersActive),
      hint: o.lawyersPending > 0 ? `${o.lawyersPending} aguardando análise` : 'nenhum em análise', alert: o.lawyersPending > 0 },
    {
      scope: 'FINANCEIRO',
      href: '/admin/financeiro',
      label: me?.isOwner ? 'Receita recorrente' : 'Assinaturas ativas',
      value: me?.isOwner && o.mrr != null ? brl(o.mrr) : String(o.activeSubscriptions),
      hint: me?.isOwner ? 'saldo mensal' : 'assinaturas ativas',
      alert: false,
    },
    { scope: 'SUPORTE', href: '/admin/suporte', label: 'Chamados abertos', value: String(o.supportOpen), hint: 'no suporte', alert: o.supportOpen > 0 },
    { scope: 'CADASTROS', href: '/admin/cadastros', label: 'Cidadãos cadastrados', value: String(o.citizens), hint: 'na plataforma', alert: false },
  ].filter((c) => can(c.scope));

  return (
    <div className="flex flex-col gap-10">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Visão geral</p>
        <h1 className="mt-1 font-serif text-4xl tracking-tightish">Painel</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Um resumo de cada área. Toque em um cartão para gerenciar.
        </p>
      </header>

      {/* Hub por área (apenas as áreas que você acessa) */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {hub.map((c) => (
          <Link key={c.href} href={c.href}>
            <Card className="h-full transition-colors hover:border-ring">
              <CardContent className="relative pt-6">
                <div className={`absolute inset-x-0 top-0 h-1 ${c.alert ? 'bg-accent' : 'bg-border'}`} aria-hidden />
                <p className="text-sm text-muted-foreground">{c.label}</p>
                <p className="mt-3 font-serif text-3xl tracking-tightish tabular-nums">{c.value}</p>
                <p className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span className={c.alert ? 'text-accent' : ''}>{c.hint}</span>
                  <span aria-hidden>→</span>
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      {/* Casos triados (panorama geral, simples) */}
      <section>
        <h2 className="mb-3 font-serif text-lg tracking-tightish">Casos triados</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Mini label="Casos triados" value={String(totalCases)} hint="no total" />
          <Mini label="Novos cadastros" value={String(stats.newUsers30d)} hint="últimos 30 dias" />
          <Mini label="Taxa de conversão" value={`${stats.conversionRatePct}%`} hint="qualificados → atendidos" />
        </div>
      </section>
    </div>
  );
}

function Mini({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-2 font-serif text-3xl tracking-tightish tabular-nums">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
