'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Spinner,
  Textarea,
  cn,
} from '@app/ui';
import { apiFetch } from '@/lib/api';

interface TicketSummary {
  id: string;
  subject: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  lastMessageAt: string;
}
interface Message {
  id: string;
  body: string;
  fromAdmin: boolean;
  createdAt: string;
}
interface Thread {
  id: string;
  subject: string;
  status: TicketSummary['status'];
  messages: Message[];
}

const STATUS: Record<TicketSummary['status'], { label: string; variant: 'danger' | 'warning' | 'success' }> = {
  OPEN: { label: 'Aberto', variant: 'warning' },
  IN_PROGRESS: { label: 'Em andamento', variant: 'warning' },
  RESOLVED: { label: 'Resolvido', variant: 'success' },
};

export default function SuportePage() {
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadList = useCallback(() => {
    return apiFetch<TicketSummary[]>('/support/tickets').then(setTickets);
  }, []);

  useEffect(() => {
    loadList().finally(() => setLoading(false));
  }, [loadList]);

  if (loading) {
    return (
      <main className="mx-auto min-h-screen max-w-2xl px-6 py-16">
        <Spinner className="text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-16">
      <h1 className="mb-2 font-serif text-3xl tracking-tightish">Suporte</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Precisa de ajuda? Abra um chamado e converse com a nossa equipe.
      </p>

      {selected ? (
        <TicketThread id={selected} onBack={() => { setSelected(null); loadList(); }} />
      ) : (
        <>
          <NewTicket onCreated={(id) => { loadList(); setSelected(id); }} />
          <h2 className="mb-3 mt-8 text-sm font-medium text-muted-foreground">Meus chamados</h2>
          {tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">Você ainda não abriu chamados.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {tickets.map((t) => (
                <button key={t.id} onClick={() => setSelected(t.id)} className="text-left">
                  <Card className="transition-colors hover:border-ring">
                    <CardContent className="flex items-center justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{t.subject}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(t.lastMessageAt).toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <Badge variant={STATUS[t.status].variant} dot>{STATUS[t.status].label}</Badge>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}

function NewTicket({ onCreated }: { onCreated: (id: string) => void }) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ id: string }>('/support/tickets', {
        method: 'POST',
        body: JSON.stringify({ subject, message }),
      });
      setSubject('');
      setMessage('');
      onCreated(res.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao abrir chamado.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Abrir um chamado</CardTitle>
        <CardDescription>Conte o que está acontecendo — respondemos por aqui.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Input placeholder="Assunto" value={subject} onChange={(e) => setSubject(e.target.value)} required />
          <Textarea rows={4} placeholder="Descreva sua dúvida ou reclamação..." value={message} onChange={(e) => setMessage(e.target.value)} required />
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={busy}>{busy ? <Spinner /> : 'Abrir chamado'}</Button>
            {error && <p className="text-sm text-accent">{error}</p>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function TicketThread({ id, onBack }: { id: string; onBack: () => void }) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const fetchThread = useCallback(() => apiFetch<Thread>(`/support/tickets/${id}`).then(setThread), [id]);

  useEffect(() => {
    fetchThread().catch(() => {});
    const timer = setInterval(() => fetchThread().catch(() => {}), 5000);
    return () => clearInterval(timer);
  }, [fetchThread]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread?.messages.length]);

  async function send() {
    if (draft.trim().length === 0) return;
    setBusy(true);
    try {
      await apiFetch(`/support/tickets/${id}/messages`, { method: 'POST', body: JSON.stringify({ body: draft }) });
      setDraft('');
      await fetchThread();
    } finally {
      setBusy(false);
    }
  }

  if (!thread) return <Spinner className="text-muted-foreground" />;

  return (
    <div className="flex flex-col gap-3">
      <button onClick={onBack} className="self-start text-sm text-muted-foreground hover:text-foreground">
        ← Meus chamados
      </button>
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl tracking-tightish">{thread.subject}</h2>
        <Badge variant={STATUS[thread.status].variant} dot>{STATUS[thread.status].label}</Badge>
      </div>

      <Card>
        <CardContent className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto py-4">
          {thread.messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                'max-w-[80%] rounded-lg px-4 py-2.5 text-sm',
                m.fromAdmin ? 'self-start border border-border bg-card' : 'self-end bg-primary text-primary-foreground',
              )}
            >
              <p className="whitespace-pre-wrap">{m.body}</p>
              <p className={cn('mt-1 text-[10px]', m.fromAdmin ? 'text-muted-foreground' : 'text-primary-foreground/70')}>
                {m.fromAdmin ? 'Equipe' : 'Você'} · {new Date(m.createdAt).toLocaleString('pt-BR')}
              </p>
            </div>
          ))}
          <div ref={endRef} />
        </CardContent>
      </Card>

      {thread.status === 'RESOLVED' ? (
        <p className="text-sm text-muted-foreground">Este chamado foi resolvido. Abra um novo se precisar.</p>
      ) : (
        <div className="flex flex-col gap-2">
          <Textarea rows={3} placeholder="Escreva sua mensagem..." value={draft} onChange={(e) => setDraft(e.target.value)} />
          <Button onClick={send} disabled={busy} className="self-start">Enviar</Button>
        </div>
      )}
    </div>
  );
}
