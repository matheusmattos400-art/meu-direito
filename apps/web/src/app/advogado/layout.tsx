import Link from 'next/link';

export default function AdvogadoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/advogado" className="font-serif text-lg tracking-tightish">
            Workspace
          </Link>
          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/advogado/oportunidades" className="hover:text-foreground">
              Oportunidades
            </Link>
            <Link href="/advogado/casos" className="hover:text-foreground">
              Meus casos
            </Link>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-10">{children}</div>
    </div>
  );
}
