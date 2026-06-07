'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Badge, Button, Card, CardContent, Spinner, Textarea, cn } from '@app/ui';
import { apiFetch } from '@/lib/api';
import { STATUS_META } from '../page';

interface Message {
  id: string;
  body: string;
  authorRole: string;
  fromAdmin: boolean;
  createdAt: string;
}
interface Thread {
  id: string;
  subject: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  requesterName: string | null;
  requesterRole: string;
  messages: Message[];
}

export default function AdminTicketPage() {
  const { id } = useParams<{ id: string }>();
  const [thread, setThread] = useState<Thread | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const fetchThread = useCallback(async () => {
    const t = await apiFetch<Thread>(`/admin/support/tickets/${id}`);
    setThread(t);
  }, [id]);

  useEffect(() => {
    fetchThread().catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar.'));
    // chat ao vivo: atualiza a cada 5s
    const timer = setInterval(() => {
      fetchThread().catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [fetchThread]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread?.messages.length]);

  async function send() {
    if (draft.trim().length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/admin/support/tickets/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: draft }),
      });
      setDraft('');
      await fetchThread();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar.');
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: 'IN_PROGRESS' | 'RESOLVED') {
    setBusy(true);
    try {
      await apiFetch(`/admin/support/tickets/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      await fetchThread();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar status.');
    } finally {
      setBusy(false);
    }
  }

  if (!thread) return <Spinner className="text-muted-foreground" />;
  const st = STATUS_META[thread.status];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/admin/suporte" className="text-sm text-muted-foreground hover:text-foreground">
          ← Suporte
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl tracking-tightish">{thread.subject}</h1>
            <p className="text-sm text-muted-foreground">
              {thread.requesterName} · {thread.requesterRole === 'LAWYER' ? 'Advogado' : 'Público'}
            </p>
          </div>
          <Badge variant={st.variant} dot>{st.label}</Badge>
        </div>
      </div>

      <Card>
        <CardContent className="flex max-h-[55vh] flex-col gap-3 overflow-y-auto py-4">
          {thread.messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                'max-w-[80%] rounded-lg px-4 py-2.5 text-sm',
                m.fromAdmin
                  ? 'self-end bg-primary text-primary-foreground'
                  : 'self-start border border-border bg-card',
              )}
            >
              <p className="whitespace-pre-wrap">{m.body}</p>
              <p className={cn('mt-1 text-[10px]', m.fromAdmin ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                {m.fromAdmin ? 'Equipe' : 'Cliente'} · {new Date(m.createdAt).toLocaleString('pt-BR')}
              </p>
            </div>
          ))}
          <div ref={endRef} />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        <Textarea rows={3} placeholder="Escreva sua resposta..." value={draft} onChange={(e) => setDraft(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <Button onClick={send} disabled={busy}>Responder</Button>
          {thread.status !== 'IN_PROGRESS' && (
            <Button variant="outline" onClick={() => setStatus('IN_PROGRESS')} disabled={busy}>
              Marcar em andamento
            </Button>
          )}
          {thread.status !== 'RESOLVED' && (
            <Button variant="accent" onClick={() => setStatus('RESOLVED')} disabled={busy}>
              Resolver chamado
            </Button>
          )}
        </div>
        {error && <p className="text-sm text-accent">{error}</p>}
      </div>
    </div>
  );
}
