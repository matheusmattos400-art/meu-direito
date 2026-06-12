'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge, Card, CardContent, Spinner } from '@app/ui';
import { apiFetch } from '@/lib/api';
import { STATUS_META } from '@/lib/support-status';

interface Ticket {
  id: string;
  subject: string;
  requesterName: string | null;
  requesterRole: 'CITIZEN' | 'LAWYER' | 'ADMIN';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  messages: number;
  lastMessageAt: string;
}

const FILTERS: Array<{ key: 'ALL' | Ticket['status']; label: string }> = [
  { key: 'ALL', label: 'Todos' },
  { key: 'OPEN', label: 'Não resolvidos' },
  { key: 'IN_PROGRESS', label: 'Em andamento' },
  { key: 'RESOLVED', label: 'Resolvidos' },
];

const STATUS_ORDER: Record<Ticket['status'], number> = { OPEN: 0, IN_PROGRESS: 1, RESOLVED: 2 };

export default function SuporteAdminPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'LAWYER' | 'PUBLIC'>('LAWYER');
  const [filter, setFilter] = useState<'ALL' | Ticket['status']>('ALL');

  useEffect(() => {
    apiFetch<Ticket[]>('/admin/support/tickets')
      .then(setTickets)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const resolved = tickets.filter((t) => t.status === 'RESOLVED').length;
    const lawyers = tickets.filter((t) => t.requesterRole === 'LAWYER').length;
    return {
      total: tickets.length,
      resolved,
      notResolved: tickets.length - resolved,
      lawyers,
      publico: tickets.length - lawyers,
    };
  }, [tickets]);

  const list = useMemo(() => {
    const byTab = tickets.filter((t) =>
      tab === 'LAWYER' ? t.requesterRole === 'LAWYER' : t.requesterRole !== 'LAWYER',
    );
    const byFilter = filter === 'ALL' ? byTab : byTab.filter((t) => t.status === filter);
    // não resolvidos no topo
    return [...byFilter].sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
    );
  }, [tickets, tab, filter]);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Atendimento</p>
        <h1 className="mt-1 font-serif text-4xl tracking-tightish">Suporte</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Reclamações e dúvidas sobre a plataforma — advogados e público em geral.
        </p>
      </header>

      {/* Números do suporte */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Chamados" value={stats.total} />
        <Stat label="Não resolvidos" value={stats.notResolved} accent={stats.notResolved > 0} />
        <Stat label="Resolvidos" value={stats.resolved} />
        <Stat label="De advogados" value={stats.lawyers} />
        <Stat label="Do público" value={stats.publico} />
      </div>

      {/* Abas: Advogados × Público em geral */}
      <div className="flex gap-6 border-b border-border">
        <button
          onClick={() => setTab('LAWYER')}
          className={`-mb-px border-b-2 pb-3 text-sm transition-colors ${
            tab === 'LAWYER' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Advogados <span className="ml-1 tabular-nums opacity-70">{stats.lawyers}</span>
        </button>
        <button
          onClick={() => setTab('PUBLIC')}
          className={`-mb-px border-b-2 pb-3 text-sm transition-colors ${
            tab === 'PUBLIC' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Público em geral <span className="ml-1 tabular-nums opacity-70">{stats.publico}</span>
        </button>
      </div>

      {/* Filtro por status */}
      <div className="-mt-3 flex flex-wrap gap-2">
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

      {loading ? (
        <Spinner className="text-muted-foreground" />
      ) : error ? (
        <p className="text-sm text-accent">{error}</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum chamado nesta categoria.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((t) => {
            const st = STATUS_META[t.status];
            return (
              <Link key={t.id} href={`/admin/suporte/${t.id}`}>
                <Card className="transition-colors hover:border-ring">
                  <CardContent className="flex items-center justify-between gap-4 py-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{t.subject}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {t.requesterName} · {t.messages} mensagem(ns) ·{' '}
                        {new Date(t.lastMessageAt).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <Badge variant={st.variant} dot>
                      {st.label}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="relative pt-5">
        <div className={`absolute inset-x-0 top-0 h-1 ${accent ? 'bg-accent' : 'bg-border'}`} aria-hidden />
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 font-serif text-3xl tracking-tightish tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
