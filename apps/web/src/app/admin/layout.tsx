'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Spinner } from '@app/ui';
import { useMe } from '@/lib/use-me';

const NAV = [
  { href: '/admin', label: 'Painel', icon: 'M3 12l9-9 9 9M5 10v10h14V10' },
  { href: '/admin/advogados', label: 'Advogados', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM4 21v-1a6 6 0 0112 0v1' },
  { href: '/admin/usuarios', label: 'Usuários', icon: 'M12 12a5 5 0 100-10 5 5 0 000 10zM3 21a9 9 0 0118 0' },
  { href: '/admin/conhecimento', label: 'Conhecimento', icon: 'M4 5a2 2 0 012-2h12v18H6a2 2 0 01-2-2V5zM8 7h8M8 11h8' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { me, loading } = useMe();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && me?.role !== 'ADMIN') router.replace('/');
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
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card/60 px-4 py-6 md:flex">
        <Link href="/admin" className="mb-8 px-2">
          <span className="font-serif text-xl tracking-tightish">Meu Direito</span>
          <span className="mt-0.5 block text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Administração
          </span>
        </Link>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => {
            const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d={item.icon} />
                </svg>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto px-3 pt-6 text-xs text-muted-foreground">
          {me.email}
        </div>
      </aside>

      <div className="flex-1">
        {/* topo mobile */}
        <header className="flex items-center gap-4 border-b border-border px-6 py-4 md:hidden">
          <span className="font-serif text-lg tracking-tightish">Meu Direito</span>
          <nav className="ml-auto flex gap-4 text-sm text-muted-foreground">
            {NAV.map((i) => (
              <Link key={i.href} href={i.href} className="hover:text-foreground">
                {i.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-10 md:px-10">{children}</main>
      </div>
    </div>
  );
}
