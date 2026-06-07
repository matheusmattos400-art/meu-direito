# Rodando a stack localmente

Guia para subir tudo de ponta a ponta. Há **dois caminhos**:

- **Caminho A — Supabase (recomendado):** roda o produto completo (Auth + Storage +
  Postgres com pgvector). É o ambiente "de verdade".
- **Caminho B — só backend (Docker):** Postgres local via docker-compose para testar
  a **API pela Swagger** sem Auth/Storage. Útil para um teste rápido.

Em ambos, IA e Datajud podem rodar **simulados** (`AI_MOCK=true`, sem `DATAJUD_API_KEY`),
então você não precisa de chaves pagas para ver os fluxos.

---

## Pré-requisitos

- **Node >= 20** e **pnpm** via corepack:
  ```bash
  corepack enable
  corepack prepare pnpm@9.12.3 --activate
  ```
  > No Windows, se `corepack enable` falhar por permissão, rode o terminal como
  > Administrador, ou prefixe os comandos com `corepack pnpm@9.12.3 ...`.
- **Docker** (apenas para o Caminho B).

Instale as dependências e compile os pacotes uma vez:

```bash
pnpm install
pnpm build      # compila os pacotes @app/* (a API consome o dist deles)
```

---

## Caminho A — Supabase (produto completo)

### 1. Criar o projeto Supabase
1. Crie um projeto em https://supabase.com (escolha a região **South America (São Paulo)**).
2. Em **Database → Extensions**, habilite a extensão **`vector`** (pgvector).
3. Em **Storage**, crie um bucket **privado** chamado `documents`.

### 2. Coletar as credenciais (Project Settings)
- **API:** `Project URL`, `anon key`, `service_role key`.
- **Database:** a connection string (Connection Pooling para `DATABASE_URL` e a
  conexão direta para `DIRECT_URL`).
- **JWT:** `JWT Secret` (Settings → API → JWT Settings).

### 3. Configurar variáveis de ambiente

**Raiz do monorepo** — copie `.env.example` para `.env` e preencha:

```bash
cp .env.example .env    # Windows PowerShell: Copy-Item .env.example .env
```

```dotenv
# Banco (Supabase). Pooling para a app; conexão direta para migrations.
DATABASE_URL="postgresql://postgres.<ref>:<senha>@<host>:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.<ref>:<senha>@<host>:5432/postgres"

SUPABASE_URL="https://<ref>.supabase.co"
SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."
SUPABASE_STORAGE_BUCKET="documents"
SUPABASE_JWT_SECRET="..."

# IA e Datajud podem ficar simulados:
AI_MOCK="true"
# (para IA real: AI_MOCK="false" + OPENAI_API_KEY="sk-...")

# Quem será admin (promovido no 1º login):
ADMIN_EMAILS="seu-email@exemplo.com"

API_PORT="3333"
WEB_URL="http://localhost:3000"
```

**Front** — copie o exemplo e preencha:

```bash
cp apps/web/.env.example apps/web/.env.local
```

```dotenv
NEXT_PUBLIC_API_URL="http://localhost:3333/api"
NEXT_PUBLIC_SUPABASE_URL="https://<ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
```

### 4. Aplicar o schema e popular dados

```bash
pnpm db:migrate     # cria as tabelas + extensão vector (1ª vez: nomeie a migration)
pnpm db:seed        # categorias jurídicas + termos de consentimento
```

### 5. Subir a aplicação

```bash
pnpm dev            # sobe API (:3333) e Web (:3000) juntos
```

- Web: http://localhost:3000
- API (Swagger): http://localhost:3333/docs

### 6. Testar o fluxo
1. Acesse `/login` e entre com seu e-mail (link mágico do Supabase).
2. Como seu e-mail está em `ADMIN_EMAILS`, você vira **ADMIN** → acesse `/admin`.
3. **Cidadão:** `/triagem` → descreva um caso → converse → "Concluir e organizar".
4. **Conhecimento (RAG):** em `/admin/conhecimento`, cole um trecho de lei; novas
   triagens passam a recuperá-lo como contexto.
5. **Advogado:** registre o perfil (via `POST /api/lawyers/register` na Swagger ou
   tela futura), envie documentos em `/advogado/verificacao`, valide em
   `/admin/advogados`, e veja oportunidades em `/advogado/oportunidades`.

---

## Caminho B — só backend (Docker, sem Auth)

Para testar a API isoladamente pela Swagger, sem Supabase:

```bash
pnpm infra:up       # Postgres + pgvector em localhost:5432
# .env: DATABASE_URL e DIRECT_URL apontando para o Postgres local (valores
# padrão do .env.example já servem); deixe SUPABASE_JWT_SECRET vazio.
pnpm db:migrate
pnpm db:seed
pnpm --filter @app/api dev
```

> Sem `SUPABASE_JWT_SECRET`, as rotas autenticadas retornam 401 — útil para validar
> o boot, o `/api/health` (público) e o contrato OpenAPI em `/docs`. Para exercitar
> rotas autenticadas, use o Caminho A.

Encerrar o banco: `pnpm infra:down`.

---

## Solução de problemas

- **`turbo: cannot find binary` / pnpm não encontrado:** rode `corepack enable` (admin)
  ou use os comandos por app: `pnpm --filter @app/api dev` e `pnpm --filter @app/web dev`.
- **Erro de migration com pgvector:** confirme que a extensão `vector` está habilitada
  no Supabase (passo A.1) ou que o Postgres é a imagem `pgvector/pgvector`.
- **Front não autentica:** confira `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` em
  `apps/web/.env.local` e o `SUPABASE_JWT_SECRET` na raiz.
- **IA/processos "simulados":** é o esperado com `AI_MOCK=true` / sem `DATAJUD_API_KEY`.
