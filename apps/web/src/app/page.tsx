import Link from 'next/link';
import { Button } from '@app/ui';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-24">
      <span className="mb-6 text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Orientação jurídica informativa
      </span>
      <h1 className="font-serif text-5xl leading-tight tracking-tightish text-foreground sm:text-6xl">
        Entenda seus direitos com clareza e tranquilidade.
      </h1>
      <p className="mt-6 max-w-xl text-lg text-muted-foreground">
        Conte o que está acontecendo. Nossa triagem inteligente ajuda você a compreender seus
        direitos, os documentos necessários e os próximos passos — de forma gratuita, informativa
        e cuidadosa com seus dados.
      </p>
      <div className="mt-10 flex flex-wrap gap-4">
        <Link href="/triagem">
          <Button size="lg">Começar minha triagem</Button>
        </Link>
        <Link href="/login">
          <Button size="lg" variant="outline">
            Entrar
          </Button>
        </Link>
      </div>
      <p className="mt-12 max-w-xl text-sm text-muted-foreground">
        Esta plataforma oferece orientação informativa e não substitui a análise de um advogado
        habilitado. A validação jurídica final depende de um profissional.
      </p>
    </main>
  );
}
