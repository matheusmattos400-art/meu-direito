'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, Input, Spinner } from '@app/ui';
import { apiFetch } from '@/lib/api';

interface Person {
  id: string;
  name: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  gender: string | null;
  createdAt: string;
}

export default function CadastrosPage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    apiFetch<Person[]>('/admin/people')
      .then(setPeople)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return people;
    return people.filter(
      (p) => (p.name ?? '').toLowerCase().includes(term) || (p.phone ?? '').includes(term),
    );
  }, [people, q]);

  // Agrupa por região (UF).
  const byState = useMemo(() => {
    const map = new Map<string, Person[]>();
    for (const p of filtered) {
      const key = p.state ?? 'Sem região';
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Base</p>
        <h1 className="mt-1 font-serif text-4xl tracking-tightish">Cadastros</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cidadãos cadastrados no app, por região. Clique no nome para ver os dados e o processo.
          Total: {people.length}.
        </p>
      </header>

      <Input
        placeholder="Pesquisar por nome ou telefone..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="sm:max-w-xs"
      />

      {loading ? (
        <Spinner className="text-muted-foreground" />
      ) : error ? (
        <p className="text-sm text-accent">{error}</p>
      ) : byState.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum cadastro ainda.</p>
      ) : (
        <div className="flex flex-col gap-8">
          {byState.map(([state, list]) => (
            <section key={state}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <span className="rounded-md border border-border px-2 py-0.5 text-xs tracking-wide">{state}</span>
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs">{list.length}</span>
              </h2>
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="px-4 py-3 font-medium">Nome</th>
                          <th className="px-4 py-3 font-medium">Telefone</th>
                          <th className="px-4 py-3 font-medium">Cidade</th>
                          <th className="px-4 py-3 font-medium">Sexo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map((p) => (
                          <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                            <td className="px-4 py-3">
                              <Link href={`/admin/cadastros/${p.id}`} className="hover:underline">
                                {p.name ?? '— (sem nome)'}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{p.phone ?? '—'}</td>
                            <td className="px-4 py-3 text-muted-foreground">{p.city ?? '—'}</td>
                            <td className="px-4 py-3 text-muted-foreground">{p.gender ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
