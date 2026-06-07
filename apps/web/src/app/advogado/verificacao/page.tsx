'use client';

import { useEffect, useRef, useState } from 'react';
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
import { getSupabaseBrowser } from '@/lib/supabase';

interface LawyerProfile {
  id: string;
  oab: string;
  verification: 'PENDING' | 'VERIFIED' | 'REJECTED';
  verifiedAt: string | null;
}
interface VDoc {
  id: string;
  fileName: string;
  downloadUrl: string;
}
interface SignedUpload {
  bucket: string;
  path: string;
  token: string;
}

const STATUS: Record<string, { label: string; tone: string }> = {
  PENDING: { label: 'Em análise', tone: 'text-muted-foreground' },
  VERIFIED: { label: 'Verificado', tone: 'text-foreground' },
  REJECTED: { label: 'Rejeitado', tone: 'text-accent' },
};

export default function VerificacaoPage() {
  const [profile, setProfile] = useState<LawyerProfile | null>(null);
  const [docs, setDocs] = useState<VDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function refresh() {
    const [p, d] = await Promise.all([
      apiFetch<LawyerProfile>('/lawyers/me'),
      apiFetch<VDoc[]>('/lawyers/verification-documents'),
    ]);
    setProfile(p);
    setDocs(d);
  }

  useEffect(() => {
    refresh()
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const signed = await apiFetch<SignedUpload>('/lawyers/verification-documents/upload-url', {
        method: 'POST',
        body: JSON.stringify({ fileName: file.name, mimeType: file.type || 'application/octet-stream' }),
      });
      const supabase = getSupabaseBrowser();
      const { error: upErr } = await supabase.storage
        .from(signed.bucket)
        .uploadToSignedUrl(signed.path, signed.token, file);
      if (upErr) throw upErr;

      await apiFetch('/lawyers/verification-documents', {
        method: 'POST',
        body: JSON.stringify({
          storageKey: signed.path,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
        }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro no upload.');
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  if (loading) return <Spinner className="text-muted-foreground" />;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-2 font-serif text-3xl tracking-tightish">Verificação de OAB</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Envie o comprovante da sua inscrição na OAB. Nossa equipe valida os documentos antes de
        liberar o acesso às oportunidades.
      </p>

      {profile && (
        <Card className="mb-6">
          <CardContent className="flex items-center justify-between py-4 text-sm">
            <span>
              OAB <span className="font-medium">{profile.oab}</span>
            </span>
            <span className={STATUS[profile.verification]?.tone}>
              {STATUS[profile.verification]?.label ?? profile.verification}
            </span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comprovantes enviados</CardTitle>
          <CardDescription>Ex.: carteira da OAB, certidão de regularidade.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <input
            ref={fileInput}
            type="file"
            onChange={handleFile}
            disabled={busy}
            className="text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-transparent file:px-3 file:py-1.5 file:text-sm"
          />
          {docs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum documento enviado ainda.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {docs.map((d) => (
                <li key={d.id} className="rounded-md border border-border px-3 py-2 text-sm">
                  <a href={d.downloadUrl} target="_blank" rel="noreferrer" className="hover:underline">
                    {d.fileName}
                  </a>
                </li>
              ))}
            </ul>
          )}
          {error && <p className="text-sm text-accent">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
