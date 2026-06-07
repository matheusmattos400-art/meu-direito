'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Spinner,
  Textarea,
} from '@app/ui';
import { apiFetch } from '@/lib/api';

interface Peca {
  id: string;
  title: string;
  content: string;
  version: number;
  type: string;
}
interface CaseDoc {
  id: string;
  fileName: string;
  downloadUrl: string;
}

export default function EditorPecasPage() {
  const params = useParams();
  const caseId = String(params.caseId);

  const [pecas, setPecas] = useState<Peca[]>([]);
  const [docs, setDocs] = useState<CaseDoc[]>([]);
  const [selected, setSelected] = useState<Peca | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [instruction, setInstruction] = useState('');
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<Peca[]>(`/pecas?caseId=${caseId}`),
      apiFetch<CaseDoc[]>(`/pecas/documents?caseId=${caseId}`).catch(() => []),
    ])
      .then(([p, d]) => {
        setPecas(p);
        setDocs(d);
        if (p[0]) selectPeca(p[0]);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  function selectPeca(p: Peca) {
    setSelected(p);
    setTitle(p.title);
    setContent(p.content);
    setSuggestion(null);
  }

  async function createPeca() {
    setBusy(true);
    setError(null);
    try {
      const created = await apiFetch<Peca>('/pecas', {
        method: 'POST',
        body: JSON.stringify({ caseId, title: 'Nova peça', content: '' }),
      });
      setPecas((list) => [created, ...list]);
      selectPeca(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar peça.');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await apiFetch<Peca>(`/pecas/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title, content }),
      });
      setPecas((list) => list.map((p) => (p.id === updated.id ? updated : p)));
      setSelected(updated);
      setSavedAt(new Date().toLocaleTimeString('pt-BR'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setBusy(false);
    }
  }

  async function askAi() {
    if (instruction.trim().length === 0) return;
    setBusy(true);
    setError(null);
    setSuggestion(null);
    try {
      const res = await apiFetch<{ suggestion: string }>('/pecas/ai', {
        method: 'POST',
        body: JSON.stringify({ caseId, instruction, currentContent: content }),
      });
      setSuggestion(res.suggestion);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro na IA.');
    } finally {
      setBusy(false);
    }
  }

  function insertSuggestion() {
    if (!suggestion) return;
    setContent((c) => (c ? `${c}\n\n${suggestion}` : suggestion));
    setSuggestion(null);
    setInstruction('');
  }

  if (loading) return <Spinner className="text-muted-foreground" />;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* Editor */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título da peça"
            disabled={!selected}
            className="max-w-md font-serif"
          />
          <div className="flex items-center gap-3">
            {savedAt && <span className="text-xs text-muted-foreground">Salvo {savedAt}</span>}
            <Button size="sm" onClick={save} disabled={!selected || busy}>
              Salvar {selected ? `(v${selected.version})` : ''}
            </Button>
          </div>
        </div>

        {selected ? (
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={22}
            placeholder="Escreva a peça aqui, ou peça ajuda à IA ao lado..."
            className="font-serif leading-relaxed"
          />
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Selecione ou crie uma peça para começar.
            </CardContent>
          </Card>
        )}
        {error && <p className="text-sm text-accent">{error}</p>}
      </div>

      {/* Lateral */}
      <aside className="flex flex-col gap-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Peças</CardTitle>
            <Button size="sm" variant="outline" onClick={createPeca} disabled={busy}>
              Nova
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {pecas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma peça ainda.</p>
            ) : (
              pecas.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectPeca(p)}
                  className={`rounded-md px-3 py-2 text-left text-sm hover:bg-muted ${
                    selected?.id === p.id ? 'bg-muted font-medium' : ''
                  }`}
                >
                  {p.title}
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assistente de IA</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Textarea
              rows={3}
              placeholder="Ex.: redija a qualificação das partes e os fatos a partir do resumo do caso."
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
            />
            <Button size="sm" onClick={askAi} disabled={busy || !selected}>
              {busy ? <Spinner /> : 'Gerar sugestão'}
            </Button>
            {suggestion && (
              <div className="flex flex-col gap-2 rounded-md border border-border bg-muted p-3">
                <p className="whitespace-pre-wrap text-xs">{suggestion}</p>
                <Button size="sm" variant="accent" onClick={insertSuggestion}>
                  Inserir no final
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documentos do caso</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {docs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem documentos.</p>
            ) : (
              docs.map((d) => (
                <a
                  key={d.id}
                  href={d.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate rounded-md px-3 py-2 text-sm hover:bg-muted"
                >
                  {d.fileName}
                </a>
              ))
            )}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
