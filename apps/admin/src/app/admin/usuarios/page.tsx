'use client';

import { useEffect, useState } from 'react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Spinner } from '@app/ui';
import { apiFetch } from '@/lib/api';
import { useMe } from '@/lib/use-me';

interface Admin {
  id: string;
  email: string | null;
  fullName: string | null;
  isOwner: boolean;
  scopes: string[];
  provisionalPassword: string | null;
}

const SCOPES: Array<{ key: string; label: string }> = [
  { key: 'ADVOGADOS', label: 'Advogados' },
  { key: 'FINANCEIRO', label: 'Financeiro' },
  { key: 'SUPORTE', label: 'Suporte' },
  { key: 'CADASTROS', label: 'Cadastros' },
  { key: 'USUARIOS', label: 'Usuários' },
];

export default function UsuariosPage() {
  const { me } = useMe();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const isOwner = me?.isOwner ?? false;

  function load() {
    apiFetch<Admin[]>('/admin/admins')
      .then(setAdmins)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function toggleScope(a: Admin, scope: string) {
    const scopes = a.scopes.includes(scope) ? a.scopes.filter((s) => s !== scope) : [...a.scopes, scope];
    setAdmins((list) => list.map((x) => (x.id === a.id ? { ...x, scopes } : x)));
    try {
      await apiFetch(`/admin/admins/${a.id}/scopes`, { method: 'POST', body: JSON.stringify({ scopes }) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar escopos.');
      load();
    }
  }

  async function remove(a: Admin) {
    if (!confirm(`Remover acesso de administrador de ${a.fullName ?? a.email}?`)) return;
    try {
      await apiFetch(`/admin/admins/${a.id}/remove`, { method: 'POST' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover.');
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Acesso</p>
          <h1 className="mt-1 font-serif text-4xl tracking-tightish">Administradores</h1>
        </div>
        {isOwner && (
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Fechar' : '+ Novo administrador'}
          </Button>
        )}
      </header>

      {!isOwner && (
        <p className="text-sm text-muted-foreground">
          Apenas o administrador proprietário pode criar administradores e definir permissões.
        </p>
      )}

      {showForm && isOwner && <NewAdminForm onCreated={() => { setShowForm(false); load(); }} />}

      {loading ? (
        <Spinner className="text-muted-foreground" />
      ) : error ? (
        <p className="text-sm text-accent">{error}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {admins.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex flex-col gap-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">
                      {a.fullName ?? a.email}{' '}
                      {a.isOwner && <Badge variant="accent">Proprietário</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">{a.email}</p>
                    {a.provisionalPassword && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Senha definida: <span className="text-foreground">{a.provisionalPassword}</span>
                      </p>
                    )}
                  </div>
                  {isOwner && !a.isOwner && (
                    <Button size="sm" variant="outline" onClick={() => remove(a)}>
                      Remover
                    </Button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {a.isOwner ? (
                    <span className="text-xs text-muted-foreground">Acesso total a todas as abas.</span>
                  ) : (
                    SCOPES.map((s) => {
                      const on = a.scopes.includes(s.key);
                      return (
                        <button
                          key={s.key}
                          disabled={!isOwner}
                          onClick={() => toggleScope(a, s.key)}
                          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                            on
                              ? 'border-accent bg-accent/10 text-accent'
                              : 'border-border text-muted-foreground hover:bg-muted'
                          } ${!isOwner ? 'cursor-default opacity-70' : ''}`}
                        >
                          {s.label}
                        </button>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function NewAdminForm({ onCreated }: { onCreated: () => void }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [scopes, setScopes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(s: string) {
    setScopes((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  }
  function gen() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let p = '';
    for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)];
    setPassword(p);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/admin/admins', {
        method: 'POST',
        body: JSON.stringify({ fullName, email, password, scopes }),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar administrador.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Novo administrador</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Nome completo" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          <Input type="email" placeholder="E-mail (login)" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <div className="flex gap-2 sm:col-span-2">
            <Input placeholder="Senha de acesso" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <Button type="button" variant="outline" size="sm" onClick={gen}>Gerar</Button>
          </div>
          <div className="sm:col-span-2">
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Abas que pode acessar</p>
            <div className="flex flex-wrap gap-2">
              {SCOPES.map((s) => (
                <button
                  type="button"
                  key={s.key}
                  onClick={() => toggle(s.key)}
                  className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                    scopes.includes(s.key)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? <Spinner /> : 'Criar administrador'}
            </Button>
            {error && <p className="text-sm text-accent">{error}</p>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
