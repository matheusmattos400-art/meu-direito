'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card, CardContent, CardHeader, CardTitle, Spinner } from '@app/ui';
import { apiFetch } from '@/lib/api';
import { CASE_STATUS_LABEL } from '@/lib/case-status';
import { LogoutButton } from '@/components/logout-button';

interface CaseItem {
  id: string;
  protocol: string;
  status: string;
  potential: string | null;
  title: string | null;
  createdAt: string;
}

export default function MeusCasosPage() {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<CaseItem[]>('/cases')
      .then(setCases)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar casos.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-16">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-serif text-3xl tracking-tightish">Meus Casos</h1>
        <div className="flex gap-2">
          <Link href="/suporte">
            <Button size="sm" variant="outline">Suporte</Button>
          </Link>
          <Link href="/triagem">
            <Button size="sm">Novo caso</Button>
          </Link>
          <LogoutButton className="px-2 text-sm text-muted-foreground hover:text-foreground" />
        </div>
      </div>

      {loading ? (
        <Spinner className="text-muted-foreground" />
      ) : error ? (
        <p className="text-sm text-accent">{error}</p>
      ) : cases.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Você ainda não tem casos. Comece uma triagem para organizar sua situação.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {cases.map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle className="text-base">{c.title ?? `Caso ${c.protocol}`}</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Protocolo {c.protocol}</span>
                <span className="rounded-full border border-border px-3 py-1 text-xs">
                  {CASE_STATUS_LABEL[c.status] ?? c.status}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
