import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-10">{children}</div>
    </div>
  );
}
