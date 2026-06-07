'use client';

import { getSupabaseBrowser } from './supabase';

/** Encerra a sessão (Supabase + atalho de dev) e volta ao login. */
export async function logout() {
  try {
    await getSupabaseBrowser().auth.signOut();
  } catch {
    /* sem sessão Supabase (ex.: dev) — segue */
  }
  if (typeof window !== 'undefined') {
    localStorage.removeItem('devEmail');
    localStorage.removeItem('devRole');
    window.location.href = '/login';
  }
}
