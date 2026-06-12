'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Spinner, Textarea, cn } from '@app/ui';
import { apiFetch } from '@/lib/api';
import { getSupabaseBrowser } from '@/lib/supabase';
import { STATUS_META } from '@/lib/support-status';
import { SUPPORT_CATEGORIES, SYSTEM_CATEGORY_CODES } from '@app/validation';

const CAT_LABEL: Record<string, string> = Object.fromEntries(SUPPORT_CATEGORIES.map((c) => [c.code, c.label]));

interface Attachment {
  name: string | null;
  url: string;
}
interface Message {
  id: string;
  body: string;
  fromAdmin: boolean;
  createdAt: string;
  attachment: Attachment | null;
}
interface CurrentLawyer {
  lawyerId: string;
  name: string | null;
  oab: string;
  state: string;
  city: string | null;
}
interface Thread {
  id: string;
  subject: string;
  category: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  requesterName: string | null;
  requesterRole: string;
  currentLawyer: CurrentLawyer | null;
  messages: Message[];
}
interface LawyerOption {
  lawyerId: string;
  name: string | null;
  oab: string;
  state: string;
  city: string | null;
  specialties: string[];
}

export default function AdminTicketPage() {
  const { id } = useParams<{ id: string }>();
  const [thread, setThread] = useState<Thread | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const fetchThread = useCallback(async () => {
    setThread(await apiFetch<Thread>(`/admin/support/tickets/${id}`));
  }, [id]);

  useEffect(() => {
    fetchThread().catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar.'));
    const t = setInterval(() => fetchThread().catch(() => {}), 5000);
    return () => clearInterval(t);
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao enviar.');
    } finally {
      setBusy(false);
    }
  }

  async function attach(file: File) {
    setBusy(true);
    setError(null);
    try {
      const signed = await apiFetch<{ bucket: string; path: string; token: string }>(
        `/admin/support/tickets/${id}/attachment-url`,
        { method: 'POST', body: JSON.stringify({ fileName: file.name, mimeType: file.type || 'application/octet-stream' }) },
      );
      const supabase = getSupabaseBrowser();
      const { error: upErr } = await supabase.storage.from(signed.bucket).uploadToSignedUrl(signed.path, signed.token, file);
      if (upErr) throw upErr;
      await apiFetch(`/admin/support/tickets/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          body: draft || '',
          attachmentKey: signed.path,
          attachmentName: file.name,
          attachmentMime: file.type || 'application/octet-stream',
        }),
      });
      setDraft('');
      await fetchThread();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao anexar (verifique o Storage).');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function setStatus(status: 'IN_PROGRESS' | 'RESOLVED') {
    setBusy(true);
    try {
      await apiFetch(`/admin/support/tickets/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) });
      await fetchThread();
    } finally {
      setBusy(false);
    }
  }

  async function resolveSystem() {
    if (!confirm('Resolver pelo sistema? Vou reativar o acesso/assinatura do solicitante e fechar o chamado.')) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/admin/support/tickets/${id}/resolve-system`, { method: 'POST' });
      await fetchThread();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao resolver.');
    } finally {
      setBusy(false);
    }
  }

  async function grantAccess(days: number) {
    setBusy(true);
    setError(null);
    try {
      const r = await apiFetch<{ until: string; days: number }>(
        `/admin/support/tickets/${id}/grant-access`,
        { method: 'POST', body: JSON.stringify({ days }) },
      );
      await apiFetch(`/admin/support/tickets/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          body: `✅ Acesso liberado por ${days} dias (até ${new Date(r.until).toLocaleDateString('pt-BR')}).`,
        }),
      });
      await fetchThread();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao liberar acesso.');
    } finally {
      setBusy(false);
    }
  }

  async function cancelLawyer() {
    if (!confirm('Cancelar o acesso deste cliente com o advogado atual?')) return;
    setBusy(true);
    try {
      await apiFetch(`/admin/support/tickets/${id}/cancel-lawyer`, { method: 'POST' });
      await fetchThread();
    } finally {
      setBusy(false);
    }
  }

  if (!thread) return <Spinner className="text-muted-foreground" />;
  const st = STATUS_META[thread.status];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* Conversa */}
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
                {thread.category ? ` · ${CAT_LABEL[thread.category] ?? thread.category}` : ''}
              </p>
            </div>
            <Badge variant={st.variant} dot>{st.label}</Badge>
          </div>
        </div>

        {/* Ação de sistema: resolve com um clique (acesso/pagamento) */}
        {thread.category && SYSTEM_CATEGORY_CODES.includes(thread.category) && thread.status !== 'RESOLVED' && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent/40 bg-accent/10 px-4 py-3">
            <p className="text-sm">
              <strong>Problema de sistema</strong> ({CAT_LABEL[thread.category] ?? thread.category}). Posso
              reativar o acesso/assinatura e fechar o chamado.
            </p>
            <Button size="sm" disabled={busy} onClick={resolveSystem}>
              {busy ? <Spinner /> : '⚡ Resolver pelo sistema'}
            </Button>
          </div>
        )}

        <Card>
          <CardContent className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto py-4">
            {thread.messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  'max-w-[80%] rounded-lg px-4 py-2.5 text-sm',
                  m.fromAdmin ? 'self-end bg-primary text-primary-foreground' : 'self-start border border-border bg-card',
                )}
              >
                {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
                {m.attachment && (
                  <a
                    href={m.attachment.url}
                    target="_blank"
                    rel="noreferrer"
                    className={cn('mt-1 inline-flex items-center gap-1 text-xs underline', m.fromAdmin ? '' : 'text-accent')}
                  >
                    📎 {m.attachment.name ?? 'arquivo'}
                  </a>
                )}
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
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={send} disabled={busy}>Responder</Button>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) attach(f);
              }}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
              📎 {thread.requesterRole === 'LAWYER' ? 'Anexar boleto/documento' : 'Anexar documento'}
            </Button>
            {thread.status !== 'RESOLVED' && (
              <Button variant="accent" onClick={() => setStatus('RESOLVED')} disabled={busy}>
                Resolver
              </Button>
            )}
          </div>
          {error && <p className="text-sm text-accent">{error}</p>}
        </div>
      </div>

      {/* Painel lateral — depende de quem abriu o chamado */}
      <aside>
        {thread.requesterRole === 'LAWYER' ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Acesso do advogado</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Libere o acesso do advogado (ex.: perdeu o acesso por um problema, mesmo pagando).
              </p>
              <div className="flex gap-2">
                {[7, 30, 60].map((d) => (
                  <Button key={d} size="sm" variant="outline" disabled={busy} onClick={() => grantAccess(d)}>
                    {d} dias
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Advogado do cliente</CardTitle>
            </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {thread.currentLawyer ? (
              <div className="rounded-md border border-border p-3 text-sm">
                <p className="font-medium">{thread.currentLawyer.name}</p>
                <p className="text-xs text-muted-foreground">
                  OAB {thread.currentLawyer.oab}
                  {thread.currentLawyer.city ? ` · ${thread.currentLawyer.city}` : ''}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum advogado vinculado.</p>
            )}

            <Button size="sm" onClick={() => setPicker((v) => !v)}>
              {thread.currentLawyer ? 'Substituir advogado' : 'Atribuir advogado'}
            </Button>
            {thread.currentLawyer && (
              <Button size="sm" variant="outline" onClick={cancelLawyer} disabled={busy}>
                Cancelar acesso
              </Button>
            )}

            {picker && (
              <LawyerPicker
                defaultState={thread.currentLawyer?.state ?? ''}
                onPick={async (lawyerId) => {
                  setBusy(true);
                  setError(null);
                  try {
                    await apiFetch(`/admin/support/tickets/${id}/assign-lawyer`, {
                      method: 'POST',
                      body: JSON.stringify({ lawyerId }),
                    });
                    setPicker(false);
                    await fetchThread();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Erro ao atribuir.');
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            )}
          </CardContent>
          </Card>
        )}
      </aside>
    </div>
  );
}

function LawyerPicker({ defaultState, onPick }: { defaultState: string; onPick: (id: string) => void }) {
  const [state, setState] = useState(defaultState);
  const [list, setList] = useState<LawyerOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch<LawyerOption[]>(`/admin/support/lawyers${state ? `?state=${state.toUpperCase()}` : ''}`)
      .then(setList)
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [state]);

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/40 p-3">
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        Região (UF)
        <Input
          value={state}
          maxLength={2}
          onChange={(e) => setState(e.target.value)}
          placeholder="todas"
          className="h-8 w-20"
        />
      </label>
      {loading ? (
        <Spinner className="text-muted-foreground" />
      ) : list.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum advogado ativo {state ? `em ${state.toUpperCase()}` : ''}.</p>
      ) : (
        <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
          {list.map((l) => (
            <button
              key={l.lawyerId}
              onClick={() => onPick(l.lawyerId)}
              className="rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
            >
              <span className="font-medium">{l.name}</span>
              <span className="block text-xs text-muted-foreground">
                {l.city ? `${l.city}/${l.state}` : l.state} · {l.specialties.join(', ') || 'Sem áreas'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
