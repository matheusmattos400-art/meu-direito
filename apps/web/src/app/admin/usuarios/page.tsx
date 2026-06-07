'use client';

import { useEffect, useState } from 'react';
import { Button, Card, CardContent, Spinner } from '@app/ui';
import { apiFetch } from '@/lib/api';

interface UserRow {
  id: string;
  role: 'CITIZEN' | 'LAWYER' | 'ADMIN';
  status: string;
  email: string | null;
  fullName: string | null;
}

const ROLE_LABEL: Record<string, string> = {
  CITIZEN: 'Cidadão',
  LAWYER: 'Advogado',
  ADMIN: 'Administrador',
};

export default function AdminUsuariosPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  function load() {
    setLoading(true);
    apiFetch<UserRow[]>('/admin/users')
      .then(setUsers)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function changeRole(id: string, action: 'promote' | 'revoke-admin') {
    setActing(id);
    setError(null);
    try {
      await apiFetch(`/admin/users/${id}/${action}`, { method: 'POST' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao alterar permissão.');
    } finally {
      setActing(null);
    }
  }

  return (
    <div>
      <h1 className="mb-2 font-serif text-3xl tracking-tightish">Usuários</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Conceda ou remova acesso de administrador. O acesso administrativo não exige OAB.
      </p>

      {loading ? (
        <Spinner className="text-muted-foreground" />
      ) : error ? (
        <p className="text-sm text-accent">{error}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {users.map((u) => (
            <Card key={u.id}>
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div>
                  <p className="text-sm font-medium">{u.fullName ?? u.email ?? u.id}</p>
                  <p className="text-xs text-muted-foreground">
                    {u.email ?? '—'} · {ROLE_LABEL[u.role] ?? u.role}
                  </p>
                </div>
                {u.role === 'ADMIN' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={acting === u.id}
                    onClick={() => changeRole(u.id, 'revoke-admin')}
                  >
                    Remover admin
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={acting === u.id}
                    onClick={() => changeRole(u.id, 'promote')}
                  >
                    Tornar admin
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
