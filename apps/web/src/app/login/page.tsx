'use client';

import { useState } from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Spinner } from '@app/ui';
import { getSupabaseBrowser } from '@/lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setError(null);
    try {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/triagem` },
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
          <CardTitle>Entrar</CardTitle>
          <CardDescription>
            Enviaremos um link de acesso seguro para o seu e-mail.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === 'sent' ? (
            <p className="text-sm text-muted-foreground">
              Pronto. Verifique sua caixa de entrada e clique no link para acessar.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                type="email"
                required
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button type="submit" disabled={status === 'sending'}>
                {status === 'sending' ? <Spinner /> : 'Enviar link de acesso'}
              </Button>
              {error && <p className="text-sm text-accent">{error}</p>}
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
