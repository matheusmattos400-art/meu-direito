# Plataforma SaaS de LegalTech _(nome do produto a definir)_

Plataforma que conecta cidadãos a uma triagem jurídica inteligente por IA (gratuita, informativa e
orientativa) e oferece a advogados um workspace SaaS (CRM jurídico, gestão de casos, editor de peças
com IA e acompanhamento processual).

> **Princípios inegociáveis:** conformidade **LGPD** (dados no Brasil, consentimento, minimização,
> auditoria) e **ética OAB** (sem promessa de resultado, sem comissão por caso — receita só por
> assinatura). Ver [`docs/compliance/`](docs/compliance/).

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend Web | Next.js (App Router) + TypeScript + Tailwind + shadcn/ui |
| Backend / API | NestJS (TypeScript), OpenAPI |
| Banco / Auth / Storage | Supabase (Postgres + pgvector, região São Paulo) |
| ORM | Prisma |
| IA | Camada `@app/ai-core` multi-provedor (Vercel AI SDK) |
| Monorepo | Turborepo + pnpm |
| Mobile (futuro) | Expo (React Native) |

## Estrutura

```
apps/        web (Next.js) · api (NestJS) · mobile (futuro)
packages/    db (Prisma) · ai-core · types · validation · ui · config
docs/        architecture · compliance · api · runbooks
```

## Como rodar (desenvolvimento)

> Guia completo (Supabase ou Docker, passo a passo): [`docs/runbooks/RUNNING.md`](docs/runbooks/RUNNING.md).

Pré-requisitos: **Node >= 20**, **Docker** e **pnpm** (via corepack).

```bash
# 1. habilitar o pnpm (vem com o Node)
corepack enable
corepack prepare pnpm@9.12.3 --activate

# 2. instalar dependências
pnpm install

# 3. variáveis de ambiente
cp .env.example .env   # (Windows PowerShell: Copy-Item .env.example .env)

# 4. subir o banco local (Postgres + pgvector)
pnpm infra:up

# 5. aplicar schema e popular dados iniciais
pnpm db:migrate
pnpm db:seed

# 6. iniciar tudo
pnpm dev
```

## Convenções

- Pacotes internos usam o escopo neutro `@app/*` — quando o nome do produto for definido, basta
  renomear o `name` da raiz; os pacotes não precisam mudar.
