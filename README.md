# Tutorio

Финансовый календарь для частных преподавателей и малых школ: абонементы, баланс занятий, журнал операций, расписание.

План MVP: [docs/mvp-plan.md](docs/mvp-plan.md) · Деплой: [docs/deploy.md](docs/deploy.md)

## Структура

```
apps/
  api/        NestJS + Prisma + PostgreSQL (Swagger на /docs)
  web/        Next.js (App Router) + Tailwind
packages/
  domain/     чистая бизнес-логика (vitest, без I/O)
  validation/ Zod-схемы DTO, общие для web и api
  api-client/ типизированный клиент, генерируется из OpenAPI
  config/     общие tsconfig / eslint пресеты
```

## Быстрый старт

```bash
pnpm install
cp apps/api/.env.example apps/api/.env        # вписать DATABASE_URL
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @tutorio/api prisma:migrate     # миграции БД
pnpm dev                                      # api :4000, web :3000
```

## Команды

| Команда | Что делает |
|---|---|
| `pnpm dev` | dev-серверы api + web |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build` | пайплайн (то же в CI) |
| `pnpm generate` | OpenAPI → `packages/api-client` |
