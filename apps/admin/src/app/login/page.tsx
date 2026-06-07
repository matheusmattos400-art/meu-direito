'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Spinner } from '@app/ui';
import { getSupabaseBrowser } from '@/lib/supabase';
import { apiFetch } from '@/lib/api';

type Mode = 'password' | 'magic';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  /** Só administradores entram aqui; demais perfis são barrados. */
  async function ensureAdminOrReject(): Promise<boolean> {
    try {
      const me = await apiFetch<{ role: string }>('/me');
      if (me.role === 'ADMIN') return true;
    } catch {
      /* ignore */
    }
    await getSupabaseBrowser().auth.signOut();
    setStatus('error');
    setError('Acesso exclusivo para administradores.');
    return false;
  }

  async function signInPassword(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setError(null);
    try {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (await ensureAdminOrReject()) router.push('/admin');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'E-mail ou senha inválidos.');
    }
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setError(null);
    try {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/admin` },
      });
      if (error) throw error;
      setStatus('sent');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Não foi possível enviar o link.');
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <Card>
        <CardHeader>
          <CardTitle>Administração</CardTitle>
          <CardDescription>Acesso restrito à equipe administrativa.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex gap-2 rounded-lg border border-border p-1">
            <button
              onClick={() => { setMode('password'); setStatus('idle'); setError(null); }}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm transition-colors ${
                mode === 'password' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              Senha
            </button>
            <button
              onClick={() => { setMode('magic'); setStatus('idle'); setError(null); }}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm transition-colors ${
                mode === 'magic' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              Link por e-mail
            </button>
          </div>

          {mode === 'magic' && status === 'sent' ? (
            <p className="text-sm text-muted-foreground">
              Pronto. Verifique sua caixa de entrada e clique no link para acessar.
            </p>
          ) : (
            <form onSubmit={mode === 'password' ? signInPassword : sendMagicLink} className="flex flex-col gap-3">
              <Input
                type="email"
                required
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {mode === 'password' && (
                <Input
                  type="password"
                  required
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              )}
              <Button type="submit" disabled={status === 'loading'}>
                {status === 'loading' ? <Spinner /> : mode === 'password' ? 'Entrar' : 'Enviar link de acesso'}
              </Button>
              {error && <p className="text-sm text-accent">{error}</p>}
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
