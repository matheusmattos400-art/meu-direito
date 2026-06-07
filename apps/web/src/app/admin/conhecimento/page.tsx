'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Spinner,
  Textarea,
} from '@app/ui';
import { apiFetch } from '@/lib/api';

interface KDoc {
  id: string;
  title: string;
  source: string;
  type: string;
  chunks: number;
  createdAt: string;
}

const TYPES = [
  { value: 'LEGISLATION', label: 'Legislação' },
  { value: 'JURISPRUDENCE', label: 'Jurisprudência' },
  { value: 'ADMINISTRATIVE', label: 'Norma administrativa' },
  { value: 'INTERNAL', label: 'Base interna' },
];

export default function ConhecimentoPage() {
  const [docs, setDocs] = useState<KDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [source, setSource] = useState('');
  const [type, setType] = useState('LEGISLATION');
  const [content, setContent] = useState('');

  function load() {
    apiFetch<KDoc[]>('/admin/knowledge')
      .then(setDocs)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function ingest(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/admin/knowledge', {
        method: 'POST',
        body: JSON.stringify({ title, source, type, content }),
      });
      setTitle('');
      setSource('');
      setContent('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao ingerir.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="mb-2 font-serif text-3xl tracking-tightish">Base de conhecimento</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Conteúdo jurídico que fundamenta a triagem da IA (busca semântica via embeddings).
      </p>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">Adicionar conteúdo</CardTitle>
          <CardDescription>O texto é dividido em trechos e indexado por similaridade.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={ingest} className="flex flex-col gap-3">
            <Input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                placeholder="Fonte (ex.: CDC art. 18)"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                required
              />
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="h-10 rounded-md border border-input bg-transparent px-3 text-sm sm:w-56"
              >
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <Textarea
              rows={8}
              placeholder="Cole aqui o texto da legislação, jurisprudência ou norma..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
            <Button type="submit" disabled={busy}>
              {busy ? <Spinner /> : 'Indexar conteúdo'}
            </Button>
            {error && <p className="text-sm text-accent">{error}</p>}
          </form>
        </CardContent>
      </Card>

      <h2 className="mb-3 text-sm font-medium text-muted-foreground">Documentos indexados</h2>
      {loading ? (
        <Spinner className="text-muted-foreground" />
      ) : docs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum documento na base ainda.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {docs.map((d) => (
            <Card key={d.id}>
              <CardContent className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium">{d.title}</p>
                  <p className="text-xs text-muted-foreground">{d.source}</p>
                </div>
                <span className="text-xs text-muted-foreground">{d.chunks} trechos</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
