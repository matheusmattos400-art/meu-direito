'use client';

import { getSupabaseBrowser } from './supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Fetch autenticado: anexa o access token do Supabase como Bearer. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let token: string | undefined;
  try {
    const supabase = getSupabaseBrowser();
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token;
  } catch {
    // Supabase não configurado — segue sem token (rotas públicas / dev bypass).
  }

  // Atalho de desenvolvimento (somente quando não há sessão Supabase).
  const devEmail = !token && typeof window !== 'undefined' ? localStorage.getItem('devEmail') : null;
  const devRole = devEmail ? localStorage.getItem('devRole') : null;

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(devEmail ? { 'x-dev-email': devEmail } : {}),
      ...(devRole ? { 'x-dev-role': devRole } : {}),
      ...init?.headers,
    },
  });

  const body = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const message =
      (body as { message?: string } | null)?.message ?? `Erro ${res.status} na requisição.`;
    throw new ApiError(res.status, message, body);
  }
  // A API responde no formato { data: ... }
  return (body as { data: T }).data;
}
