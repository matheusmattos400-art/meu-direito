'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Avatar, Badge, Button, Card, CardContent, Spinner } from '@app/ui';
import { apiFetch } from '@/lib/api';
import { LAWYER_STATUS_META, type LawyerStatus } from '@/lib/lawyer-status';

interface LawyerRow {
  lawyerId: string;
  name: string | null;
  email: string | null;
  oab: string;
  state: string;
  city: string | null;
  avatarUrl: string | null;
  specialties: string[];
  processCount: number;
  status: LawyerStatus;
}

const TABS: Array<{ key: 'ALL' | LawyerStatus; label: string }> = [
  { key: 'ALL', label: 'Todos' },
  { key: 'ACTIVE', label: 'Ativos' },
  { key: 'PRE_REGISTRATION', label: 'Pré-cadastro' },
  { key: 'IN_ANALYSIS', label: 'Análise' },
  { key: 'CANCELED', label: 'Cancelados' },
  { key: 'REJECTED', label: 'Rejeitados' },
];

export default function AdvogadosPage() {
  const [rows, setRows] = useState<LawyerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'ALL' | LawyerStatus>('ALL');

  useEffect(() => {
    apiFetch<LawyerRow[]>('/admin/lawyers')
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: rows.length };
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const filtered = tab === 'ALL' ? rows : rows.filter((r) => r.status === tab);

  // Agrupa por estado (UF).
  const byState = useMemo(() => {
    const map = new Map<string, LawyerRow[]>();
    for (const r of filtered) {
      const arr = map.get(r.state) ?? [];
      arr.push(r);
      map.set(r.state, arr);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Cadastros</p>
          <h1 className="mt-1 font-serif text-4xl tracking-tightish">Advogados</h1>
        </div>
        <Link href="/admin/advogados/novo">
          <Button size="sm">+ Novo advogado</Button>
        </Link>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
              tab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {t.label}
            <span className="ml-1.5 tabular-nums opacity-70">{counts[t.key] ?? 0}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner className="text-muted-foreground" />
      ) : error ? (
        <p className="text-sm text-accent">{error}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum advogado nesta categoria.</p>
      ) : (
        <div className="flex flex-col gap-8">
          {byState.map(([state, lawyers]) => (
            <section key={state}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <span className="rounded-md border border-border px-2 py-0.5 text-xs tracking-wide">
                  {state}
                </span>
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs">{lawyers.length}</span>
              </h2>
              <div className="flex flex-col gap-2">
                {lawyers.map((l) => {
                  const meta = LAWYER_STATUS_META[l.status];
                  return (
                    <Link key={l.lawyerId} href={`/admin/advogados/${l.lawyerId}`}>
                      <Card className="transition-colors hover:border-ring">
                        <CardContent className="flex items-center justify-between gap-4 py-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar src={l.avatarUrl} name={l.name} size="md" />
                            <div className="min-w-0">
                              <p className="truncate font-medium">{l.name ?? 'Sem nome'}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {l.city ? `${l.city}/${l.state}` : l.state} · {l.specialties.join(' · ') || 'Sem áreas'}
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-4">
                            <span className="text-right text-xs text-muted-foreground">
                              <span className="block tabular-nums text-foreground">{l.processCount}</span>
                              processos
                            </span>
                            <Badge variant={meta.variant} dot>
                              {meta.label}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
