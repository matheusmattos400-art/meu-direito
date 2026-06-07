'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Spinner } from '@app/ui';
import { useMe } from '@/lib/use-me';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { me, loading } = useMe();
  const router = useRouter();

  // Guard: apenas ADMIN acessa. Demais perfis são redirecionados.
  useEffect(() => {
    if (!loading && me?.role !== 'ADMIN') {
      router.replace('/');
    }
  }, [loading, me, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="text-muted-foreground" />
      </div>
    );
  }

  if (me?.role !== 'ADMIN') {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <p className="text-sm text-muted-foreground">Acesso restrito.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/admin" className="font-serif text-lg tracking-tightish">
            Administração
          </Link>
          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/admin" className="hover:text-foreground">
              Painel
            </Link>
            <Link href="/admin/advogados" className="hover:text-foreground">
              Validação de OAB
            </Link>
            <Link href="/admin/usuarios" className="hover:text-foreground">
              Usuários
            </Link>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-10">{children}</div>
    </div>
  );
}
