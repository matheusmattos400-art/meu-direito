'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, cn } from '@app/ui';

type Kind = 'receita' | 'despesa';
interface Entry {
  id: string;
  kind: Kind;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
}

const STORAGE_KEY = 'advFinanceEntries';
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ReceitasPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [kind, setKind] = useState<Kind>('receita');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setEntries(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  function persist(next: Entry[]) {
    setEntries(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount.replace(',', '.'));
    if (!description.trim() || !(value > 0)) return;
    const entry: Entry = {
      id: `${Date.now()}-${Math.round(value * 100)}`,
      kind,
      description: description.trim(),
      amount: value,
      date: date || new Date().toISOString().slice(0, 10),
    };
    persist([entry, ...entries]);
    setDescription('');
    setAmount('');
    setDate('');
  }

  function remove(id: string) {
    persist(entries.filter((e) => e.id !== id));
  }

  const totals = useMemo(() => {
    const receitas = entries.filter((e) => e.kind === 'receita').reduce((t, e) => t + e.amount, 0);
    const despesas = entries.filter((e) => e.kind === 'despesa').reduce((t, e) => t + e.amount, 0);
    return { receitas, despesas, saldo: receitas - despesas };
  }, [entries]);

  return (
    <div className="flex flex-col gap-6">
      <header className="border-b border-border/60 pb-6">
        <p className="text-xs uppercase tracking-[0.3em] text-accent/80">Financeiro</p>
        <h1 className="mt-2 font-serif text-3xl tracking-tightish sm:text-4xl">Minhas receitas</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Seu controle financeiro pessoal — registre receitas e despesas. (Salvo neste navegador.)
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Summary label="Receitas" value={brl(totals.receitas)} tone="up" />
        <Summary label="Despesas" value={brl(totals.despesas)} tone="down" />
        <Summary label="Saldo" value={brl(totals.saldo)} tone={totals.saldo >= 0 ? 'up' : 'down'} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Novo lançamento</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={add} className="flex flex-col gap-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setKind('receita')}
                className={cn('flex-1 rounded-md border px-3 py-2 text-sm', kind === 'receita' ? 'border-accent bg-accent/15' : 'border-border text-muted-foreground')}
              >
                Receita
              </button>
              <button
                type="button"
                onClick={() => setKind('despesa')}
                className={cn('flex-1 rounded-md border px-3 py-2 text-sm', kind === 'despesa' ? 'border-accent bg-accent/15' : 'border-border text-muted-foreground')}
              >
                Despesa
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
              <Input placeholder="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} />
              <Input className="sm:w-32" type="number" step="0.01" placeholder="Valor" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <Input className="sm:w-40" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <Button type="submit">Adicionar</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lançamentos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {entries.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">Nenhum lançamento ainda.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {entries.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-4 px-6 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{e.description}</p>
                    <p className="text-xs text-muted-foreground">{new Date(e.date).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn('tabular-nums', e.kind === 'receita' ? 'text-emerald-400' : 'text-accent')}>
                      {e.kind === 'receita' ? '+' : '−'} {brl(e.amount)}
                    </span>
                    <button onClick={() => remove(e.id)} className="text-xs text-muted-foreground hover:text-foreground" aria-label="Remover">
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Summary({ label, value, tone }: { label: string; value: string; tone: 'up' | 'down' }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="relative pt-6">
        <div className={cn('absolute inset-x-0 top-0 h-1', tone === 'up' ? 'bg-emerald-500/70' : 'bg-accent')} aria-hidden />
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-2 font-serif text-3xl tracking-tightish tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
