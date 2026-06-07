'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Spinner } from '@app/ui';
import { apiFetch } from '@/lib/api';
import { getSupabaseBrowser } from '@/lib/supabase';

interface ConsentTerm {
  termId: string;
  type: string;
  title: string;
  content: string;
  granted: boolean;
}
interface DocItem {
  id: string;
  fileName: string;
  sizeBytes: number;
  createdAt: string;
  downloadUrl: string;
}
interface SignedUpload {
  bucket: string;
  path: string;
  token: string;
}

export function DocumentsPanel({ caseId }: { caseId: string }) {
  const [term, setTerm] = useState<ConsentTerm | null>(null);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function refresh() {
    const consents = await apiFetch<ConsentTerm[]>('/consents/required');
    const uploadTerm = consents.find((c) => c.type === 'DOCUMENT_UPLOAD') ?? null;
    setTerm(uploadTerm);
    if (uploadTerm?.granted) {
      setDocs(await apiFetch<DocItem[]>(`/documents?caseId=${caseId}`));
    }
  }

  useEffect(() => {
    refresh()
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  async function grantConsent() {
    if (!term) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/consents', {
        method: 'POST',
        body: JSON.stringify({ termId: term.termId, granted: true }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar consentimento.');
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const signed = await apiFetch<SignedUpload>('/documents/upload-url', {
        method: 'POST',
        body: JSON.stringify({ caseId, fileName: file.name, mimeType: file.type || 'application/octet-stream' }),
      });

      const supabase = getSupabaseBrowser();
      const { error: upErr } = await supabase.storage
        .from(signed.bucket)
        .uploadToSignedUrl(signed.path, signed.token, file);
      if (upErr) throw upErr;

      await apiFetch('/documents', {
        method: 'POST',
        body: JSON.stringify({
          caseId,
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

  async function removeDoc(id: string) {
    setBusy(true);
    try {
      await apiFetch(`/documents/${id}`, { method: 'DELETE' });
      setDocs((d) => d.filter((x) => x.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner className="text-muted-foreground" />;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Documentos</CardTitle>
        <CardDescription>Anexe documentos relevantes ao seu caso.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {term && !term.granted ? (
          <div className="flex flex-col gap-3 rounded-md border border-border bg-muted p-4">
            <p className="text-sm font-medium">{term.title}</p>
            <p className="text-xs text-muted-foreground">{term.content}</p>
            <Button size="sm" onClick={grantConsent} disabled={busy}>
              {busy ? <Spinner /> : 'Li e concordo — autorizar envio de documentos'}
            </Button>
          </div>
        ) : (
          <>
            <div>
              <input
                ref={fileInput}
                type="file"
                onChange={handleFile}
                disabled={busy}
                className="text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-transparent file:px-3 file:py-1.5 file:text-sm"
              />
            </div>
            {docs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum documento enviado.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {docs.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <a href={d.downloadUrl} target="_blank" rel="noreferrer" className="hover:underline">
                      {d.fileName}
                    </a>
                    <button
                      onClick={() => removeDoc(d.id)}
                      className="text-xs text-muted-foreground hover:text-accent"
                    >
                      Excluir
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        {error && <p className="text-sm text-accent">{error}</p>}
      </CardContent>
    </Card>
  );
}
