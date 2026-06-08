import Link from 'next/link';
import { LogoutButton } from '@/components/logout-button';

export default function AdvogadoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/advogado" className="font-serif text-lg tracking-tightish">
            Workspace
          </Link>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <Link href="/advogado" className="hover:text-foreground">
              Painel
            </Link>
            <Link href="/advogado/oportunidades" className="hover:text-foreground">
              Chamadas
            </Link>
            <Link href="/advogado/processos" className="hover:text-foreground">
              Processos
            </Link>
            <Link href="/advogado/receitas" className="hover:text-foreground">
              Minhas receitas
            </Link>
            <Link href="/advogado/planos" className="hover:text-foreground">
              Planos
            </Link>
            <Link href="/advogado/verificacao" className="hover:text-foreground">
              Verificação
            </Link>
            <Link href="/suporte" className="hover:text-foreground">
              Suporte
            </Link>
            <LogoutButton className="hover:text-foreground" />
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-10">{children}</div>
    </div>
  );
}
