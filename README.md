# Tutorio

Financial calendar for private tutors and small schools: lesson packages, lesson credit balance, operations ledger, scheduling.

MVP plan: [docs/mvp-plan.md](docs/mvp-plan.md) · Deploy: [docs/deploy.md](docs/deploy.md)

## Structure

```
apps/
  api/        NestJS + Prisma + PostgreSQL (Swagger at /docs)
  web/        Next.js (App Router) + Tailwind
packages/
  domain/     pure business logic (vitest, no I/O)
  validation/ Zod DTO schemas shared by web and api
  api-client/ typed client generated from OpenAPI
  config/     shared tsconfig / eslint presets
```

## Quick Start

```bash
pnpm install
cp apps/api/.env.example apps/api/.env        # set DATABASE_URL
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @tutorio/api prisma:migrate     # run DB migrations
pnpm dev                                      # api :4000, web :3000
```

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | dev servers for api + web |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build` | pipeline (same as CI) |
| `pnpm generate` | OpenAPI → `packages/api-client` |
