'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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

const PENDING: LawyerStatus[] = ['PRE_REGISTRATION', 'IN_ANALYSIS'];
const MANAGE_TABS: Array<{ key: 'ALL' | LawyerStatus; label: string }> = [
  { key: 'ALL', label: 'Todos' },
  { key: 'ACTIVE', label: 'Ativos' },
  { key: 'CANCELED', label: 'Cancelados' },
  { key: 'REJECTED', label: 'Rejeitados' },
];

export default function AdvogadosPage() {
  const [rows, setRows] = useState<LawyerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'pre' | 'manage'>('pre');
  const [tab, setTab] = useState<'ALL' | LawyerStatus>('ALL');

  const loadRows = useCallback(() => {
    return apiFetch<LawyerRow[]>('/admin/lawyers')
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const pendingCount = useMemo(() => rows.filter((r) => PENDING.includes(r.status)).length, [rows]);

  // Gestão: exclui os que estão em pré-cadastro (eles vivem na outra aba).
  const manageRows = useMemo(() => rows.filter((r) => !PENDING.includes(r.status)), [rows]);
  const filtered = tab === 'ALL' ? manageRows : manageRows.filter((r) => r.status === tab);
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

      {/* Abas internas: fila de verificação × gestão */}
      <div className="flex gap-6 border-b border-border">
        <button
          onClick={() => setView('pre')}
          className={`-mb-px border-b-2 pb-3 text-sm transition-colors ${
            view === 'pre' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Pré-cadastro
          {pendingCount > 0 && (
            <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">{pendingCount}</span>
          )}
        </button>
        <button
          onClick={() => setView('manage')}
          className={`-mb-px border-b-2 pb-3 text-sm transition-colors ${
            view === 'manage' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Advogados <span className="ml-1 tabular-nums opacity-70">{manageRows.length}</span>
        </button>
      </div>

      {view === 'pre' ? (
        <PreCadastro onChanged={loadRows} />
      ) : loading ? (
        <Spinner className="text-muted-foreground" />
      ) : error ? (
        <p className="text-sm text-accent">{error}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {MANAGE_TABS.map((t) => {
              const n = t.key === 'ALL' ? manageRows.length : manageRows.filter((r) => r.status === t.key).length;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                    tab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {t.label}
                  <span className="ml-1.5 tabular-nums opacity-70">{n}</span>
                </button>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum advogado nesta categoria.</p>
          ) : (
            <div className="flex flex-col gap-8">
              {byState.map(([state, lawyers]) => (
                <section key={state}>
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <span className="rounded-md border border-border px-2 py-0.5 text-xs tracking-wide">{state}</span>
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
        </>
      )}
    </div>
  );
}

// ---------------- Pré-cadastro (fila de verificação) ----------------

interface PendingDoc {
  id: string;
  kind: 'IDENTITY' | 'OAB' | 'RESIDENCE' | 'OTHER' | null;
  fileName: string;
  downloadUrl: string;
}
interface PendingLawyer {
  lawyerId: string;
  name: string | null;
  email: string | null;
  cpf: string | null;
  phone: string | null;
  oab: string;
  state: string;
  city: string | null;
  avatarUrl: string | null;
  specialties: string[];
  status: LawyerStatus;
  termAccepted: boolean;
  submittedAt: string | null;
  documents: PendingDoc[];
}

const DOC_LABEL: Record<string, string> = {
  IDENTITY: 'Identidade',
  OAB: 'Carteira OAB',
  RESIDENCE: 'Comprovante de residência',
  OTHER: 'Outro documento',
};

function PreCadastro({ onChanged }: { onChanged: () => void }) {
  const [items, setItems] = useState<PendingLawyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<PendingLawyer[]>('/admin/lawyers/pending')
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  async function decide(l: PendingLawyer, approve: boolean) {
    let reason: string | undefined;
    if (!approve) {
      const r = window.prompt('Motivo da reprovação (opcional):') ?? '';
      reason = r.trim() || undefined;
    } else if (!window.confirm(`Aprovar ${l.name ?? 'este advogado'}? Ele passa a ter acesso à plataforma.`)) {
      return;
    }
    setBusy(l.lawyerId);
    setError(null);
    try {
      await apiFetch(`/admin/lawyers/${l.lawyerId}/${approve ? 'activate' : 'reject'}`, {
        method: 'POST',
        body: approve ? undefined : JSON.stringify({ reason }),
      });
      setItems((list) => list.filter((x) => x.lawyerId !== l.lawyerId));
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao processar.');
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <Spinner className="text-muted-foreground" />;
  if (error) return <p className="text-sm text-accent">{error}</p>;
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Nenhum advogado aguardando verificação no momento.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Analise os dados e documentos enviados. Ao aprovar, o advogado vai para a gestão normal.
      </p>
      {items.map((l) => (
        <Card key={l.lawyerId}>
          <CardContent className="flex flex-col gap-4 pt-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar src={l.avatarUrl} name={l.name} size="md" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{l.name ?? 'Sem nome'}</p>
                  <p className="text-xs text-muted-foreground">
                    OAB {l.oab} · {l.city ? `${l.city}/${l.state}` : l.state}
                  </p>
                </div>
              </div>
              <Badge variant={l.status === 'IN_ANALYSIS' ? 'warning' : 'neutral'} dot>
                {l.status === 'IN_ANALYSIS' ? 'Em análise' : 'Pré-cadastro'}
              </Badge>
            </div>

            <div className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <Field label="E-mail" value={l.email} />
              <Field label="Telefone" value={l.phone} />
              <Field label="CPF" value={l.cpf} />
              <Field label="Áreas" value={l.specialties.join(', ') || '—'} />
              <Field label="Termo aceito" value={l.termAccepted ? 'Sim' : 'Não'} />
              <Field
                label="Enviado em"
                value={l.submittedAt ? new Date(l.submittedAt).toLocaleDateString('pt-BR') : '—'}
              />
            </div>

            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Documentos</p>
              {l.documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum documento enviado.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {l.documents.map((d) => (
                    <a
                      key={d.id}
                      href={d.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:border-accent/40"
                    >
                      📄 {DOC_LABEL[d.kind ?? 'OTHER'] ?? 'Documento'}
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 border-t border-border pt-4">
              <Button size="sm" disabled={busy === l.lawyerId} onClick={() => decide(l, true)}>
                {busy === l.lawyerId ? <Spinner /> : 'Aprovar'}
              </Button>
              <Button size="sm" variant="outline" disabled={busy === l.lawyerId} onClick={() => decide(l, false)} className="text-accent">
                Reprovar
              </Button>
              <Link href={`/admin/advogados/${l.lawyerId}`} className="ml-auto self-center text-sm text-muted-foreground hover:text-foreground">
                Ver ficha completa →
              </Link>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}: </span>
      <span>{value || '—'}</span>
    </div>
  );
}
