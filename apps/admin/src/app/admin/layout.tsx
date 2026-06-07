'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Spinner } from '@app/ui';
import { useMe } from '@/lib/use-me';
import { apiFetch } from '@/lib/api';
import { LogoutButton } from '@/components/logout-button';

const NAV: Array<{ href: string; label: string; icon: string; scope: string | null }> = [
  { href: '/admin', label: 'Painel', icon: 'M3 12l9-9 9 9M5 10v10h14V10', scope: null },
  { href: '/admin/advogados', label: 'Advogados', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM4 21v-1a6 6 0 0112 0v1', scope: 'ADVOGADOS' },
  { href: '/admin/financeiro', label: 'Financeiro', icon: 'M3 7h18v10H3zM3 11h18M7 15h3', scope: 'FINANCEIRO' },
  { href: '/admin/suporte', label: 'Suporte', icon: 'M21 11.5a8.38 8.38 0 01-8.5 8.5 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 0117 0z', scope: 'SUPORTE' },
  { href: '/admin/cadastros', label: 'Cadastros', icon: 'M4 4h16v16H4zM4 9h16M9 4v16', scope: 'CADASTROS' },
  { href: '/admin/usuarios', label: 'Usuários', icon: 'M12 12a5 5 0 100-10 5 5 0 000 10zM3 21a9 9 0 0118 0', scope: 'USUARIOS' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { me, loading } = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [notif, setNotif] = useState<{ supportOpen: number; lawyersPending: number }>({
    supportOpen: 0,
    lawyersPending: 0,
  });

  useEffect(() => {
    setCollapsed(localStorage.getItem('adminSidebarCollapsed') === '1');
  }, []);
  useEffect(() => {
    if (!loading && me?.role !== 'ADMIN') router.replace('/login');
  }, [loading, me, router]);
  useEffect(() => {
    if (me?.role !== 'ADMIN') return;
    let active = true;
    const load = () =>
      apiFetch<{ supportOpen: number; lawyersPending: number }>('/admin/notifications')
        .then((n) => active && setNotif(n))
        .catch(() => {});
    load();
    const timer = setInterval(load, 20000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [me]);

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

  const can = (scope: string | null) => !scope || me.isOwner || me.adminScopes.includes(scope);
  const nav = NAV.filter((i) => can(i.scope));

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
          {nav.map((item) => {
            const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
            const count =
              item.scope === 'SUPORTE' ? notif.supportOpen : item.scope === 'ADVOGADOS' ? notif.lawyersPending : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`relative flex items-center gap-3 rounded-lg py-2 text-sm transition-colors ${
                  collapsed ? 'justify-center px-0' : 'px-3'
                } ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d={item.icon} />
                </svg>
                {!collapsed && <span className="flex-1">{item.label}</span>}
                {count > 0 &&
                  (collapsed ? (
                    <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent" />
                  ) : (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                      {count}
                    </span>
                  ))}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-2 pt-6">
          {!collapsed && <div className="px-3 text-xs text-muted-foreground">{me.email}</div>}
          <LogoutButton
            className={`flex items-center gap-3 rounded-lg py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${
              collapsed ? 'justify-center px-0' : 'px-3'
            }`}
            label={collapsed ? '⎋' : 'Sair'}
          />
        </div>
      </aside>

      <div className="flex-1">
        <header className="flex items-center gap-4 border-b border-border px-6 py-4 md:hidden">
          <span className="font-serif text-lg tracking-tightish">Meu Direito</span>
          <nav className="ml-auto flex gap-4 text-sm text-muted-foreground">
            {nav.map((i) => (
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
