'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@app/ui';

const DEV_ENABLED = process.env.NEXT_PUBLIC_DEV_AUTH === 'true';

/**
 * Login de DESENVOLVIMENTO (atalho). Dispensa o Supabase: grava o e-mail/perfil
 * no navegador e o apiFetch envia os headers x-dev-*. Só funciona com o backend
 * em DEV_AUTH_BYPASS=true. Não use em produção.
 */
export default function DevLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');

  function enter(role: 'ADMIN' | 'LAWYER' | 'CITIZEN', to: string) {
    localStorage.setItem('devEmail', email);
    localStorage.setItem('devRole', role);
    router.push(to);
  }

  if (!DEV_ENABLED) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <p className="text-sm text-muted-foreground">Atalho de desenvolvimento desativado.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <Card>
        <CardHeader>
          <CardTitle>Entrar (desenvolvimento)</CardTitle>
          <CardDescription>
            Atalho local sem Supabase. Use o e-mail definido em ADMIN_EMAILS para entrar como
            administrador.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Input
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="flex flex-col gap-2">
            <Button disabled={!email} onClick={() => enter('ADMIN', '/admin')}>
              Entrar como Administrador
            </Button>
            <Button variant="outline" disabled={!email} onClick={() => enter('LAWYER', '/advogado')}>
              Entrar como Advogado
            </Button>
            <Button variant="ghost" disabled={!email} onClick={() => enter('CITIZEN', '/triagem')}>
              Entrar como Cidadão
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
