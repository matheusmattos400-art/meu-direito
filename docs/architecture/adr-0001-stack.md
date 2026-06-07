# ADR 0001 — Stack e arquitetura de fundação

- **Status:** Aceito
- **Data:** 2026-06-06

## Contexto

Plataforma SaaS de LegalTech, web agora e mobile depois. Time terceirizado,
orçamento bootstrap, dados no Brasil (LGPD), IA multi-provedor.

## Decisão

- **Arquitetura:** monólito modular, API-first, TypeScript ponta a ponta.
- **API:** NestJS (modular, OpenAPI), deploy Fly.io região GRU (São Paulo).
- **Banco/Auth/Storage:** Supabase (Postgres + pgvector + Auth + Storage), São Paulo.
- **Web:** Next.js (App Router) + Tailwind + shadcn/ui (estética Quiet Luxury).
- **Mobile (futuro):** Expo, consumindo a mesma API.
- **IA:** `@app/ai-core` multi-provedor (Vercel AI SDK + adaptadores).
- **Monorepo:** Turborepo + pnpm. **ORM:** Prisma.

## Consequências

- Stack mainstream e contratável; um só ecossistema reduz custo de equipe.
- Módulos isolados permitem extrair serviços só quando houver escala/receita.
- Pacotes internos com escopo neutro `@app/*` para renomear o produto sem refatorar.
