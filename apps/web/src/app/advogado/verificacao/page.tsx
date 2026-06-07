'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Spinner } from '@app/ui';
import { apiFetch } from '@/lib/api';
import { getSupabaseBrowser } from '@/lib/supabase';
import { LAWYER_STATUS_META, type LawyerStatus } from '@/lib/lawyer-status';

interface Profile {
  status: LawyerStatus;
  termAccepted: boolean;
  submittedAt: string | null;
}
interface VDoc {
  id: string;
  kind: string | null;
  fileName: string;
}
interface SignedUpload {
  bucket: string;
  path: string;
  token: string;
}

const KINDS: Array<{ kind: 'IDENTITY' | 'OAB' | 'RESIDENCE'; label: string }> = [
  { kind: 'IDENTITY', label: 'Documento de identidade (RG/CNH)' },
  { kind: 'OAB', label: 'Carteira da OAB' },
  { kind: 'RESIDENCE', label: 'Comprovante de residência' },
];

export default function VerificacaoPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [noProfile, setNoProfile] = useState(false);
  const [docs, setDocs] = useState<VDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [term, setTerm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [p, d] = await Promise.all([
      apiFetch<Profile>('/lawyers/me'),
      apiFetch<VDoc[]>('/lawyers/verification-documents'),
    ]);
    setProfile(p);
    setTerm(p.termAccepted);
    setDocs(d);
  }

  useEffect(() => {
    refresh()
      .catch((err) => {
        if (err instanceof Error && /advogado não encontrado/i.test(err.message)) setNoProfile(true);
        else setError(err instanceof Error ? err.message : 'Erro ao carregar.');
      })
      .finally(() => setLoading(false));
  }, []);

  async function upload(kind: string, file: File) {
    setBusy(true);
    setError(null);
    try {
      const signed = await apiFetch<SignedUpload>('/lawyers/verification-documents/upload-url', {
        method: 'POST',
        body: JSON.stringify({ kind, fileName: file.name, mimeType: file.type || 'application/octet-stream' }),
      });
      const supabase = getSupabaseBrowser();
      const { error: upErr } = await supabase.storage.from(signed.bucket).uploadToSignedUrl(signed.path, signed.token, file);
      if (upErr) throw upErr;
      await apiFetch('/lawyers/verification-documents', {
        method: 'POST',
        body: JSON.stringify({
          kind,
          storageKey: signed.path,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
        }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro no upload (verifique o Storage).');
    } finally {
      setBusy(false);
    }
  }

  async function acceptTerm() {
    setBusy(true);
    try {
      await apiFetch('/lawyers/accept-term', { method: 'POST', body: JSON.stringify({ accepted: true }) });
      setTerm(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao aceitar termo.');
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/lawyers/submit-for-analysis', { method: 'POST' });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar para análise.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner className="text-muted-foreground" />;

  if (noProfile) {
    return (
      <div className="max-w-xl">
        <h1 className="mb-2 font-serif text-3xl tracking-tightish">Verificação</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Conclua seu cadastro profissional antes de enviar os documentos.
        </p>
        <Link href="/advogado/cadastro">
          <Button>Ir para o cadastro</Button>
        </Link>
      </div>
    );
  }

  const has = (k: string) => docs.some((d) => d.kind === k);
  const allDocs = KINDS.every((k) => has(k.kind));
  const meta = profile ? LAWYER_STATUS_META[profile.status] : null;
  const canSubmit = allDocs && term && profile?.status !== 'IN_ANALYSIS' && profile?.status !== 'ACTIVE';

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-3xl tracking-tightish">Verificação</h1>
        {meta && <Badge variant={meta.variant} dot>{meta.label}</Badge>}
      </div>

      {profile?.status === 'IN_ANALYSIS' && (
        <Card className="mb-6">
          <CardContent className="py-4 text-sm text-muted-foreground">
            Seus documentos estão em análise. Retornaremos em até 24 horas.
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Documentos</CardTitle>
          <CardDescription>Envie os três documentos para liberar a análise.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {KINDS.map((k) => (
            <div key={k.kind} className="flex flex-col gap-2 border-b border-border pb-4 last:border-0 last:pb-0">
              <div className="flex items-center justify-between">
                <span className="text-sm">{k.label}</span>
                {has(k.kind) ? <Badge variant="success">Enviado</Badge> : <Badge>Pendente</Badge>}
              </div>
              <input
                type="file"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(k.kind, f);
                  e.target.value = '';
                }}
                className="text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-transparent file:px-3 file:py-1.5 file:text-sm"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Termo de responsabilidade</CardTitle>
        </CardHeader>
        <CardContent>
          {term ? (
            <p className="text-sm text-muted-foreground">Termo aceito. ✓</p>
          ) : (
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1" onChange={(e) => e.target.checked && acceptTerm()} disabled={busy} />
              <span className="text-muted-foreground">
                Li e aceito o termo de responsabilidade profissional. (texto a ser definido)
              </span>
            </label>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={!canSubmit || busy}>
          {busy ? <Spinner /> : 'Enviar para análise'}
        </Button>
        {!allDocs && <span className="text-xs text-muted-foreground">Envie os 3 documentos.</span>}
        {error && <p className="text-sm text-accent">{error}</p>}
      </div>
    </div>
  );
}
