import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@app/ui';

export default function AdvogadoHome() {
  return (
    <div>
      <h1 className="mb-2 font-serif text-3xl tracking-tightish">Bem-vindo ao seu workspace</h1>
      <p className="mb-8 text-muted-foreground">Gerencie oportunidades e casos com tranquilidade.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/advogado/oportunidades">
          <Card className="transition-colors hover:border-ring">
            <CardHeader>
              <CardTitle>Oportunidades de atendimento</CardTitle>
              <CardDescription>Casos qualificados nas suas áreas de atuação.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/advogado/casos">
          <Card className="transition-colors hover:border-ring">
            <CardHeader>
              <CardTitle>Meus casos</CardTitle>
              <CardDescription>Acompanhe seus casos no quadro de gestão.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
