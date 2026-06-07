import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Plataforma Jurídica',
  description:
    'Orientação jurídica informativa e gratuita para o cidadão, com triagem inteligente.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body>{children}</body>
    </html>
  );
}
