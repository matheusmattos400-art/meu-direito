'use client';

import { useEffect, useState } from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Spinner } from '@app/ui';
import { apiFetch } from '@/lib/api';

interface PendingLawyer {
  lawyerId: string;
  name: string | null;
  email: string | null;
  oab: string;
  specialties: string[];
  createdAt: string;
}

export default function AdminAdvogadosPage() {
  const [items, setItems] = useState<PendingLawyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  function load() {
    setLoading(true);
    apiFetch<PendingLawyer[]>('/admin/lawyers/pending')
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function decide(lawyerId: string, action: 'verify' | 'reject') {
    setActing(lawyerId);
    try {
      await apiFetch(`/admin/lawyers/${lawyerId}/${action}`, {
        method: 'POST',
        body: action === 'reject' ? JSON.stringify({}) : undefined,
      });
      setItems((list) => list.filter((i) => i.lawyerId !== lawyerId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao decidir.');
    } finally {
      setActing(null);
    }
  }

  return (
    <div>
      <h1 className="mb-6 font-serif text-3xl tracking-tightish">Validação de OAB</h1>

      {loading ? (
        <Spinner className="text-muted-foreground" />
      ) : error ? (
        <p className="text-sm text-accent">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum advogado aguardando validação.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((l) => (
            <Card key={l.lawyerId}>
              <CardHeader>
                <CardTitle className="text-base">{l.name ?? 'Sem nome'}</CardTitle>
                <CardDescription>
                  OAB {l.oab} · {l.email ?? 'sem e-mail'}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">
                  {l.specialties.join(', ') || 'Sem áreas'}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" disabled={acting === l.lawyerId} onClick={() => decide(l.lawyerId, 'verify')}>
                    Validar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={acting === l.lawyerId}
                    onClick={() => decide(l.lawyerId, 'reject')}
                  >
                    Rejeitar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
