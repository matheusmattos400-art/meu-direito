'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Spinner,
} from '@app/ui';
import { apiFetch } from '@/lib/api';

interface Opportunity {
  caseId: string;
  protocol: string;
  category: string | null;
  subcategory: string | null;
  potential: string | null;
  summary: string | null;
  city: string | null;
  state: string | null;
}

const POTENTIAL_LABEL: Record<string, string> = {
  ADMINISTRATIVE: 'Administrativo',
  JUDICIAL: 'Judicial',
  DOUBT: 'Dúvida',
};

export default function OportunidadesPage() {
  const [items, setItems] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  function load() {
    setLoading(true);
    apiFetch<Opportunity[]>('/opportunities')
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function respond(caseId: string, action: 'accept' | 'decline') {
    setActing(caseId);
    try {
      await apiFetch(`/opportunities/${caseId}/${action}`, {
        method: 'POST',
        body: action === 'decline' ? JSON.stringify({}) : undefined,
      });
      setItems((list) => list.filter((i) => i.caseId !== caseId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao responder.');
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b border-border/60 pb-6">
        <p className="text-xs uppercase tracking-[0.3em] text-accent/80">Atendimento</p>
        <h1 className="mt-2 font-serif text-3xl tracking-tightish sm:text-4xl">Chamadas</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Novos casos qualificados nas suas áreas de atuação.
        </p>
      </header>

      {loading ? (
        <Spinner className="text-muted-foreground" />
      ) : error ? (
        <p className="text-sm text-accent">{error}</p>
      ) : items.length === 0 ? (
        <Card className="border-border/60 bg-card/70">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma chamada disponível nas suas áreas no momento.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((o) => (
            <Card key={o.caseId} className="border-border/60 bg-card/70 transition-colors hover:border-accent/40">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    {o.category ?? 'Caso'} {o.subcategory ? `· ${o.subcategory}` : ''}
                  </CardTitle>
                  {o.potential && (
                    <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs text-accent">
                      {POTENTIAL_LABEL[o.potential] ?? o.potential}
                    </span>
                  )}
                </div>
                <CardDescription>
                  Protocolo {o.protocol}
                  {o.city ? ` · ${o.city}${o.state ? `/${o.state}` : ''}` : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">{o.summary ?? 'Sem resumo.'}</p>
                <div className="flex gap-2">
                  <Button size="sm" disabled={acting === o.caseId} onClick={() => respond(o.caseId, 'accept')}>
                    Aceitar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={acting === o.caseId}
                    onClick={() => respond(o.caseId, 'decline')}
                  >
                    Recusar
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
