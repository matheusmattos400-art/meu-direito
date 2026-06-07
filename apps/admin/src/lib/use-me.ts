'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from './api';

export interface Me {
  id: string;
  role: 'CITIZEN' | 'LAWYER' | 'ADMIN';
  status: string;
  email: string | null;
  fullName: string | null;
  isOwner: boolean;
  adminScopes: string[];
}

export interface UseMe {
  me: Me | null;
  loading: boolean;
  error: string | null;
}

/** Carrega o perfil do usuário autenticado (GET /me). */
export function useMe(): UseMe {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Me>('/me')
      .then(setMe)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao autenticar.'))
      .finally(() => setLoading(false));
  }, []);

  return { me, loading, error };
}
