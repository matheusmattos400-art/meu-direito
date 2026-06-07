'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Spinner } from '@app/ui';
import { useMe } from '@/lib/use-me';

const NAV = [
  { href: '/admin', label: 'Painel', icon: 'M3 12l9-9 9 9M5 10v10h14V10' },
  { href: '/admin/advogados', label: 'Advogados', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM4 21v-1a6 6 0 0112 0v1' },
  { href: '/admin/financeiro', label: 'Financeiro', icon: 'M3 7h18v10H3zM3 11h18M7 15h3' },
  { href: '/admin/usuarios', label: 'Usuários', icon: 'M12 12a5 5 0 100-10 5 5 0 000 10zM3 21a9 9 0 0118 0' },
  { href: '/admin/conhecimento', label: 'Conhecimento', icon: 'M4 5a2 2 0 012-2h12v18H6a2 2 0 01-2-2V5zM8 7h8M8 11h8' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { me, loading } = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem('adminSidebarCollapsed') === '1');
  }, []);
  useEffect(() => {
    if (!loading && me?.role !== 'ADMIN') router.replace('/');
  }, [loading, me, router]);

  function toggle() {
    setCollapsed((c) => {
      localStorage.setItem('adminSidebarCollapsed', c ? '0' : '1');
      return !c;
    });
  }

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
      <aside
        className={`hidden shrink-0 flex-col border-r border-border bg-card/40 py-5 transition-[width] duration-200 md:flex ${
          collapsed ? 'w-[76px] px-3' : 'w-64 px-4'
        }`}
      >
        <div className={`mb-7 flex items-center ${collapsed ? 'justify-center' : 'justify-between px-2'}`}>
          {!collapsed && (
            <Link href="/admin">
              <span className="font-serif text-xl tracking-tightish">Meu Direito</span>
              <span className="mt-0.5 block text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                Administração
              </span>
            </Link>
          )}
          <button
            onClick={toggle}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={collapsed ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} />
            </svg>
          </button>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV.map((item) => {
            const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 rounded-lg py-2 text-sm transition-colors ${
                  collapsed ? 'justify-center px-0' : 'px-3'
                } ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d={item.icon} />
                </svg>
                {!collapsed && item.label}
              </Link>
            );
          })}
        </nav>

        {!collapsed && (
          <div className="mt-auto px-3 pt-6 text-xs text-muted-foreground">{me.email}</div>
        )}
      </aside>

      <div className="flex-1">
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
