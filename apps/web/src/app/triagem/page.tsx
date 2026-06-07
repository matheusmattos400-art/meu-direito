'use client';

import { useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Spinner,
  Textarea,
  cn,
} from '@app/ui';
import { apiFetch } from '@/lib/api';

type Role = 'user' | 'assistant';
interface ChatMessage {
  role: Role;
  content: string;
}
interface CaseSummary {
  id: string;
  protocol: string;
  status: string;
  sensitivity: 'NORMAL' | 'SENSITIVE';
}
interface StartResponse {
  case: CaseSummary;
  reply: string;
}
interface MessageResponse {
  reply: string;
}
interface Analysis {
  summary: string;
  risks: string[];
  missingDocuments: string[];
  nextSteps: string[];
  administrativePaths: string[];
  potential: 'DOUBT' | 'ADMINISTRATIVE' | 'JUDICIAL';
  sensitive: boolean;
  disclaimer: string;
}
interface AnalyzeResponse {
  case: CaseSummary;
  analysis: Analysis;
}

export default function TriagemPage() {
  const [caseInfo, setCaseInfo] = useState<CaseSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sensitive = caseInfo?.sensitivity === 'SENSITIVE' || analysis?.sensitive;

  async function start() {
    if (draft.trim().length < 20) {
      setError('Descreva seu caso com pelo menos 20 caracteres.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<StartResponse>('/cases', {
        method: 'POST',
        body: JSON.stringify({ narrative: draft }),
      });
      setCaseInfo(res.case);
      setMessages([
        { role: 'user', content: draft },
        { role: 'assistant', content: res.reply },
      ]);
      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao iniciar a triagem.');
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!caseInfo || draft.trim().length === 0) return;
    const content = draft;
    setMessages((m) => [...m, { role: 'user', content }]);
    setDraft('');
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<MessageResponse>(`/cases/${caseInfo.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
      setMessages((m) => [...m, { role: 'assistant', content: res.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar mensagem.');
    } finally {
      setBusy(false);
    }
  }

  async function analyze() {
    if (!caseInfo) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<AnalyzeResponse>(`/cases/${caseInfo.id}/analyze`, {
        method: 'POST',
      });
      setAnalysis(res.analysis);
      setCaseInfo(res.case);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao analisar o caso.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      className={cn(
        'mx-auto min-h-screen max-w-2xl px-6 py-16 transition-colors',
        sensitive && 'bg-muted',
      )}
    >
      <header className="mb-8">
        <h1 className="font-serif text-3xl tracking-tightish">Triagem do seu caso</h1>
        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <LockIcon />
          {sensitive
            ? 'Tema sensível — privacidade reforçada. Suas informações são tratadas com cuidado redobrado.'
            : 'Conversa privada e protegida. Seus dados são tratados conforme a LGPD.'}
        </p>
      </header>

      {!caseInfo ? (
        <Card>
          <CardHeader>
            <CardTitle>Conte o que está acontecendo</CardTitle>
            <CardDescription>
              Descreva sua situação com suas palavras. Quanto mais detalhes, melhor a orientação.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Textarea
              rows={6}
              placeholder="Ex.: Comprei um produto que veio com defeito e a loja se recusa a trocar..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <Button onClick={start} disabled={busy}>
              {busy ? <Spinner /> : 'Iniciar triagem'}
            </Button>
            {error && <p className="text-sm text-accent">{error}</p>}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  'max-w-[85%] rounded-lg px-4 py-3 text-sm',
                  m.role === 'user'
                    ? 'self-end bg-primary text-primary-foreground'
                    : 'self-start border border-border bg-card',
                )}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            ))}
            {busy && <Spinner className="self-start text-muted-foreground" />}
          </div>

          <div className="flex flex-col gap-2">
            <Textarea
              rows={3}
              placeholder="Escreva sua resposta..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="flex gap-2">
              <Button onClick={send} disabled={busy}>
                Enviar
              </Button>
              <Button onClick={analyze} disabled={busy} variant="outline">
                Concluir e organizar meu caso
              </Button>
            </div>
            {error && <p className="text-sm text-accent">{error}</p>}
          </div>

          {analysis && <AnalysisCard analysis={analysis} />}
        </div>
      )}
    </main>
  );
}

function AnalysisCard({ analysis }: { analysis: Analysis }) {
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Resumo do seu caso</CardTitle>
        <CardDescription>Organização preliminar para análise de um advogado.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <p className="whitespace-pre-wrap">{analysis.summary}</p>
        <Section title="Próximos passos" items={analysis.nextSteps} />
        <Section title="Documentos que podem faltar" items={analysis.missingDocuments} />
        <Section title="Pontos de atenção" items={analysis.risks} />
        {analysis.administrativePaths.length > 0 && (
          <Section title="Caminhos administrativos" items={analysis.administrativePaths} />
        )}
        <p className="border-t border-border pt-4 text-xs text-muted-foreground">
          {analysis.disclaimer}
        </p>
      </CardContent>
    </Card>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <h4 className="mb-1 font-medium">{title}</h4>
      <ul className="list-disc pl-5 text-muted-foreground">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
