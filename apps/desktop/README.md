# Meu Direito — Admin (Desktop)

Aplicativo de desktop (Tauri v2) que empacota o **app de administração** (`apps/admin`).
A API NestJS (porta 3333) continua sendo o backend ("cérebro").

## Pré-requisitos (uma vez)
- **Rust** (já instalado nesta máquina) — https://rustup.rs
- **WebView2** — já vem no Windows 11.

## Rodar em desenvolvimento
Em terminais separados, na raiz do monorepo:

```bash
# 1) API
corepack pnpm@9.12.3 --filter @app/api dev      # :3333

# 2) App admin (o desktop carrega esta URL)
corepack pnpm@9.12.3 --filter @app/admin dev     # :3001

# 3) Janela desktop
corepack pnpm@9.12.3 --filter @app/desktop dev
```

A janela abre o admin (`http://localhost:3001/admin`). O login é o mesmo (somente ADMIN).

## Build (instalador Windows)
> Empacotamento de produção do app Next (que tem rotas dinâmicas/SSR) ainda será
> finalizado. Hoje o `dist/` é um placeholder; o fluxo de produção rodará o
> servidor Next embarcado ou um export estático. Em dev, o app já funciona.

```bash
corepack pnpm@9.12.3 --filter @app/desktop build
```
