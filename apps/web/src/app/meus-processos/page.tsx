'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Spinner,
} from '@app/ui';
import { apiFetch } from '@/lib/api';

interface ProcessSummary {
  id: string;
  processNumber: string;
  court: string | null;
  className: string | null;
  subject: string | null;
  lastSyncedAt: string | null;
}
interface Movement {
  id: string;
  rawText: string;
  simplifiedText: string | null;
  occurredAt: string | null;
}
interface ProcessDetail extends ProcessSummary {
  movements: Movement[];
}

export default function MeusProcessosPage() {
  const [items, setItems] = useState<ProcessSummary[]>([]);
  const [detail, setDetail] = useState<ProcessDetail | null>(null);
  const [number, setNumber] = useState('');
  const [court, setCourt] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    apiFetch<ProcessSummary[]>('/processos')
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch<ProcessSummary>('/processos', {
        method: 'POST',
        body: JSON.stringify({ processNumber: number, court: court || undefined }),
      });
      setNumber('');
      setCourt('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao adicionar processo.');
    } finally {
      setBusy(false);
    }
  }

  async function open(id: string) {
    setBusy(true);
    try {
      setDetail(await apiFetch<ProcessDetail>(`/processos/${id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao abrir processo.');
    } finally {
      setBusy(false);
    }
  }

  async function sync(id: string) {
    setBusy(true);
    try {
      await apiFetch(`/processos/${id}/sync`, { method: 'POST' });
      await open(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao sincronizar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-16">
      <h1 className="mb-2 font-serif text-3xl tracking-tightish">Meus Processos</h1>
      <p className="mb-8 text-muted-foreground">
        Acompanhe o andamento dos seus processos em linguagem simples.
      </p>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">Acompanhar um processo</CardTitle>
          <CardDescription>Informe o número do processo (padrão CNJ).</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={add} className="flex flex-col gap-3 sm:flex-row">
            <Input
              placeholder="0000000-00.0000.0.00.0000"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              required
            />
            <Input
              placeholder="Tribunal (ex.: TJSP)"
              value={court}
              onChange={(e) => setCourt(e.target.value)}
              className="sm:max-w-[160px]"
            />
            <Button type="submit" disabled={busy}>
              {busy ? <Spinner /> : 'Adicionar'}
            </Button>
          </form>
          {error && <p className="mt-3 text-sm text-accent">{error}</p>}
        </CardContent>
      </Card>

      {loading ? (
        <Spinner className="text-muted-foreground" />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum processo em acompanhamento.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <CardTitle className="text-base">{p.className ?? 'Processo'}</CardTitle>
                <CardDescription>
                  {p.processNumber}
                  {p.court ? ` · ${p.court}` : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => open(p.id)} disabled={busy}>
                  Ver andamento
                </Button>
                <Button size="sm" variant="ghost" onClick={() => sync(p.id)} disabled={busy}>
                  Atualizar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {detail && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Andamento — {detail.processNumber}</CardTitle>
            <CardDescription>{detail.subject ?? ''}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {detail.movements.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem movimentos ainda.</p>
            ) : (
              detail.movements.map((m) => (
                <div key={m.id} className="border-l-2 border-accent pl-4">
                  <p className="text-sm">{m.simplifiedText ?? m.rawText}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Registro oficial: {m.rawText}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
