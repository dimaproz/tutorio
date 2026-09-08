# Tutorio

Financial calendar for private tutors and small schools: lesson packages, lesson credit balance, operations ledger, scheduling.

Start here: [documentation map](docs/README.md) ·
[current state](docs/current-state.md) · [architecture](docs/architecture.md) ·
[pilot roadmap](docs/roadmap.md) · [active queue](docs/next-work.md) ·
[deploy](docs/deploy.md)

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

| Command                                                     | What it does                                      |
| ----------------------------------------------------------- | ------------------------------------------------- |
| `pnpm dev`                                                  | dev servers for api + web                         |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build` | static and unit pipeline                          |
| `pnpm --filter @tutorio/api test:e2e`                       | API E2E; requires an isolated PostgreSQL database |
| `pnpm generate`                                             | OpenAPI → `packages/api-client`                   |
