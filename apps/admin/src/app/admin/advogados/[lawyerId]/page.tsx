'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Avatar, Badge, Button, Card, CardContent, CardHeader, CardTitle, Spinner } from '@app/ui';
import { apiFetch } from '@/lib/api';
import { LAWYER_STATUS_META, type LawyerStatus } from '@/lib/lawyer-status';
import { caseStatusLabel } from '@/lib/case-status';

interface Detail {
  lawyerId: string;
  status: LawyerStatus;
  credentials: {
    email: string | null;
    provisionalPassword: string | null;
    createdByAdmin: boolean;
  };
  profile: {
    fullName: string | null;
    cpf: string | null;
    email: string | null;
    phone: string | null;
    phone2: string | null;
    birthDate: string | null;
    city: string | null;
    avatarUrl: string | null;
    oab: string;
    residentialAddress: string | null;
    professionalAddress: string | null;
    specialties: string[];
  };
  term: { accepted: boolean; acceptedAt: string | null };
  submittedAt: string | null;
  clients: Array<{
    caseId: string;
    protocol: string;
    clientName: string | null;
    category: string | null;
    caseStatus: string;
  }>;
  documents: Array<{ id: string; kind: string | null; fileName: string; downloadUrl: string }>;
}

const DOC_LABEL: Record<string, string> = {
  IDENTITY: 'Documento de identidade',
  OAB: 'Carteira da OAB',
  RESIDENCE: 'Comprovante de residência',
  OTHER: 'Outro',
};

function fmtDate(v: string | null, withTime = false) {
  if (!v) return '—';
  const d = new Date(v);
  return withTime ? d.toLocaleString('pt-BR') : d.toLocaleDateString('pt-BR');
}

export default function LawyerDetailPage() {
  const { lawyerId } = useParams<{ lawyerId: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiFetch<Detail>(`/admin/lawyers/${lawyerId}`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false));
  }, [lawyerId]);

  useEffect(load, [load]);

  async function act(action: 'activate' | 'reject' | 'cancel') {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/admin/lawyers/${lawyerId}/${action}`, {
        method: 'POST',
        body: action === 'reject' ? JSON.stringify({}) : undefined,
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro na ação.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner className="text-muted-foreground" />;
  if (error && !data) return <p className="text-sm text-accent">{error}</p>;
  if (!data) return null;

  const meta = LAWYER_STATUS_META[data.status];
  const deadline = data.submittedAt ? new Date(new Date(data.submittedAt).getTime() + 24 * 3600 * 1000) : null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/admin/advogados" className="text-sm text-muted-foreground hover:text-foreground">
          ← Advogados
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <Avatar src={data.profile.avatarUrl} name={data.profile.fullName} size="lg" />
            <div>
              <h1 className="font-serif text-3xl tracking-tightish">{data.profile.fullName ?? 'Advogado'}</h1>
              <p className="text-sm text-muted-foreground">
                {data.profile.city ? `${data.profile.city} · ` : ''}OAB {data.profile.oab}
              </p>
            </div>
          </div>
          <Badge variant={meta.variant} dot>
            {meta.label}
          </Badge>
        </div>
        {data.submittedAt && (
          <p className="mt-2 text-xs text-muted-foreground">
            Enviado para análise em {fmtDate(data.submittedAt, true)} · prazo de análise até{' '}
            {fmtDate(deadline?.toISOString() ?? null, true)}
          </p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Acesso do advogado</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <Field label="Login (e-mail)" value={data.credentials.email} />
          <Field
            label="Senha"
            value={
              data.credentials.provisionalPassword ??
              (data.credentials.createdByAdmin ? '—' : 'Definida pelo próprio advogado')
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do formulário</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <Field label="Nome completo" value={data.profile.fullName} />
          <Field label="CPF" value={data.profile.cpf} />
          <Field label="E-mail" value={data.profile.email} />
          <Field label="Data de nascimento" value={fmtDate(data.profile.birthDate)} />
          <Field label="Telefone" value={data.profile.phone} />
          <Field label="Telefone 2" value={data.profile.phone2} />
          <Field label="Nº da OAB" value={data.profile.oab} />
          <Field label="Cidade de atuação" value={data.profile.city} />
          <Field label="Áreas de atuação" value={data.profile.specialties.join(', ') || null} />
          <Field label="Endereço residencial" value={data.profile.residentialAddress} />
          <Field label="Endereço profissional" value={data.profile.professionalAddress} />
          <Field
            label="Termo de responsabilidade"
            value={data.term.accepted ? `Aceito em ${fmtDate(data.term.acceptedAt, true)}` : 'Não aceito'}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Clientes da plataforma</CardTitle>
          <span className="text-sm text-muted-foreground">
            <span className="tabular-nums text-foreground">{data.clients.length}</span> cliente(s)
          </span>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {data.clients.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum cliente atribuído ainda.</p>
          ) : (
            data.clients.map((c) => (
              <div
                key={c.caseId}
                className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate">{c.clientName ?? 'Cliente'}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.category ?? 'Caso'} · {c.protocol}
                  </p>
                </div>
                <Badge>{caseStatusLabel(c.caseStatus)}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documentos enviados</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {data.documents.length === 0 ? (
            <p className="text-sm text-accent">Nenhum documento enviado.</p>
          ) : (
            data.documents.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
              >
                <span className="text-muted-foreground">{DOC_LABEL[d.kind ?? 'OTHER'] ?? 'Documento'}</span>
                <a href={d.downloadUrl} target="_blank" rel="noreferrer" className="hover:underline">
                  {d.fileName}
                </a>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        {data.status !== 'ACTIVE' && (
          <Button onClick={() => act('activate')} disabled={busy}>
            Ativar cadastro
          </Button>
        )}
        {data.status !== 'REJECTED' && (
          <Button variant="outline" onClick={() => act('reject')} disabled={busy}>
            Rejeitar
          </Button>
        )}
        {data.status === 'ACTIVE' && (
          <Button variant="ghost" onClick={() => act('cancel')} disabled={busy}>
            Cancelar conta
          </Button>
        )}
        {busy && <Spinner className="text-muted-foreground" />}
        {error && <p className="text-sm text-accent">{error}</p>}
      </div>
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
