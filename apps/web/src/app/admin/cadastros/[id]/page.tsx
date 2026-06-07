'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Badge, Card, CardContent, CardHeader, CardTitle, Spinner } from '@app/ui';
import { apiFetch } from '@/lib/api';

interface Person {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  gender: string | null;
  createdAt: string;
  process: {
    protocol: string;
    caseStatus: string;
    lawyerName: string | null;
    lawyerOab: string;
  } | null;
}

const CASE_STATUS_LABEL: Record<string, string> = {
  SUBMITTED: 'Enviado',
  TRIAGING: 'Em triagem',
  TRIAGED: 'Triado',
  RESOLVED_INFO: 'Dúvida resolvida',
  QUALIFIED: 'Qualificado',
  AVAILABLE: 'Disponível',
  ASSIGNED: 'Em atendimento',
  IN_PROGRESS: 'Em andamento',
  CLOSED: 'Encerrado',
  ARCHIVED: 'Arquivado',
};

export default function PersonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [p, setP] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Person>(`/admin/people/${id}`)
      .then(setP)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spinner className="text-muted-foreground" />;
  if (error) return <p className="text-sm text-accent">{error}</p>;
  if (!p) return null;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <Link href="/admin/cadastros" className="text-sm text-muted-foreground hover:text-foreground">
          ← Cadastros
        </Link>
        <h1 className="mt-2 font-serif text-3xl tracking-tightish">{p.name ?? 'Cidadão'}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <Field label="Nome" value={p.name} />
          <Field label="E-mail" value={p.email} />
          <Field label="Telefone" value={p.phone} />
          <Field label="Sexo" value={p.gender} />
          <Field label="Cidade" value={p.city} />
          <Field label="Região (UF)" value={p.state} />
          <Field label="Cadastrado em" value={new Date(p.createdAt).toLocaleDateString('pt-BR')} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Processo na plataforma</CardTitle>
        </CardHeader>
        <CardContent>
          {p.process ? (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm">
                  Advogado: <span className="font-medium">{p.process.lawyerName}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  OAB {p.process.lawyerOab} · Protocolo {p.process.protocol}
                </p>
              </div>
              <Badge variant="accent" dot>
                {CASE_STATUS_LABEL[p.process.caseStatus] ?? p.process.caseStatus}
              </Badge>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Sem processo aberto com advogados da plataforma.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm">{value || '—'}</p>
    </div>
  );
}
