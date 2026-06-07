'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, Spinner } from '@app/ui';
import { apiFetch } from '@/lib/api';

interface Stage {
  id: string;
  name: string;
  order: number;
  color: string | null;
}
interface BoardCard {
  assignmentId: string;
  kanbanStageId: string | null;
  caseId: string;
  protocol: string;
  title: string;
  category: string | null;
  potential: string | null;
}
interface Board {
  stages: Stage[];
  cards: BoardCard[];
}

export default function CasosKanbanPage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Board>('/workspace/board')
      .then(setBoard)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar o quadro.'))
      .finally(() => setLoading(false));
  }, []);

  async function move(assignmentId: string, kanbanStageId: string) {
    if (!board) return;
    // atualização otimista
    setBoard({
      ...board,
      cards: board.cards.map((c) =>
        c.assignmentId === assignmentId ? { ...c, kanbanStageId } : c,
      ),
    });
    try {
      await apiFetch(`/workspace/cards/${assignmentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ kanbanStageId }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao mover o card.');
    }
  }

  if (loading) return <Spinner className="text-muted-foreground" />;
  if (error) return <p className="text-sm text-accent">{error}</p>;
  if (!board) return null;

  return (
    <div>
      <h1 className="mb-6 font-serif text-3xl tracking-tightish">Meus casos</h1>
      <div className="grid auto-cols-[minmax(240px,1fr)] grid-flow-col gap-4 overflow-x-auto pb-4">
        {board.stages.map((stage) => {
          const cards = board.cards.filter((c) => c.kanbanStageId === stage.id);
          return (
            <div key={stage.id} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium">{stage.name}</h2>
                <span className="text-xs text-muted-foreground">{cards.length}</span>
              </div>
              {cards.map((card) => (
                <Card key={card.assignmentId} className="p-4">
                  <Link href={`/advogado/casos/${card.caseId}`} className="hover:underline">
                    <p className="text-sm font-medium">{card.title}</p>
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {card.category ?? 'Caso'} · {card.protocol}
                  </p>
                  <select
                    className="mt-3 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs"
                    value={card.kanbanStageId ?? ''}
                    onChange={(e) => move(card.assignmentId, e.target.value)}
                  >
                    {board.stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        Mover para: {s.name}
                      </option>
                    ))}
                  </select>
                </Card>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
