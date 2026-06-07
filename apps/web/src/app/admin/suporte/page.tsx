'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge, Card, CardContent, Spinner } from '@app/ui';
import { apiFetch } from '@/lib/api';

interface Ticket {
  id: string;
  subject: string;
  requesterName: string | null;
  requesterRole: 'CITIZEN' | 'LAWYER' | 'ADMIN';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  messages: number;
  lastMessageAt: string;
}

export const STATUS_META: Record<Ticket['status'], { label: string; variant: 'danger' | 'warning' | 'success' }> = {
  OPEN: { label: 'Não resolvido', variant: 'danger' },
  IN_PROGRESS: { label: 'Em andamento', variant: 'warning' },
  RESOLVED: { label: 'Resolvido', variant: 'success' },
};

const FILTERS: Array<{ key: 'ALL' | Ticket['status']; label: string }> = [
  { key: 'ALL', label: 'Todos' },
  { key: 'OPEN', label: 'Não resolvidos' },
  { key: 'IN_PROGRESS', label: 'Em andamento' },
  { key: 'RESOLVED', label: 'Resolvidos' },
];

export default function SuporteAdminPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | Ticket['status']>('ALL');

  useEffect(() => {
    apiFetch<Ticket[]>('/admin/support/tickets')
      .then(setTickets)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'ALL' ? tickets : tickets.filter((t) => t.status === filter);
  const advogados = useMemo(() => filtered.filter((t) => t.requesterRole === 'LAWYER'), [filtered]);
  const publico = useMemo(() => filtered.filter((t) => t.requesterRole !== 'LAWYER'), [filtered]);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Atendimento</p>
        <h1 className="mt-1 font-serif text-4xl tracking-tightish">Suporte</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Reclamações e dúvidas dos usuários sobre a plataforma (advogados e público).
        </p>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
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
      ) : (
        <div className="flex flex-col gap-8">
          <Group title="Advogados" tickets={advogados} />
          <Group title="Público em geral" tickets={publico} />
        </div>
      )}
    </div>
  );
}

function Group({ title, tickets }: { title: string; tickets: Ticket[] }) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {title}
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs">{tickets.length}</span>
      </h2>
      {tickets.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum chamado.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {tickets.map((t) => {
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
    </section>
  );
}
