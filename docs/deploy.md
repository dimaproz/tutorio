# Деплой Tutorio (Этап 0)

Всё, что ниже, делается один раз руками (нужны аккаунты). Конфиги уже в репо.

## 1. GitHub

1. Создать приватный репозиторий, запушить `main`.
2. CI (`.github/workflows/ci.yml`) заработает сам: lint + typecheck + test + build на каждый push/PR.

## 2. Railway — API + Postgres

1. Создать проект → **Deploy from GitHub repo** (этот репозиторий).
2. Добавить **PostgreSQL** (New → Database → Postgres). Включить бэкапы: Database → Backups → daily.
3. В сервисе API (Settings):
   - Root Directory: `/` (корень; сборка описана в `railway.json`).
   - Config as code подхватит `railway.json`: build → prisma generate → turbo build; healthcheck `/api/health`; перед деплоем — `prisma migrate deploy`.
4. Variables сервиса API:
   - `DATABASE_URL` → Reference на Postgres (`${{Postgres.DATABASE_URL}}`)
   - `JWT_SECRET` → сгенерировать (`openssl rand -hex 32`)
   - `WEB_ORIGIN` → URL веба на Vercel (можно добавить после шага 3)
   - `SENTRY_DSN` → из шага 4
   - `NODE_ENV=production`
5. Проверка: `https://<api-domain>/api/health` → `{"status":"ok"}`, `https://<api-domain>/docs` — Swagger.

## 3. Vercel — Web

1. Import Git Repository → этот репозиторий.
2. Root Directory: `apps/web` (Framework: Next.js — определится сам; pnpm-workspace тоже).
3. Environment Variables:
   - `NEXT_PUBLIC_API_URL` → `https://<api-domain>/api`
   - `NEXT_PUBLIC_SENTRY_DSN` → из шага 4
4. После деплоя вписать Vercel-домен в `WEB_ORIGIN` сервиса API на Railway.

## 4. Sentry

1. Создать организацию + два проекта: `tutorio-api` (Node/NestJS) и `tutorio-web` (Next.js).
2. DSN каждого проекта → в переменные Railway (`SENTRY_DSN`) и Vercel (`NEXT_PUBLIC_SENTRY_DSN`).
3. Код инициализации уже в репо (`apps/api/src/instrument.ts`, `apps/web/src/instrumentation*.ts`) — без DSN он просто выключен.

## 5. Локальная разработка

```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # вписать DATABASE_URL (можно Railway dev-базу)
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @tutorio/api prisma:migrate   # первая миграция
pnpm dev                                    # turbo: api на :4000, web на :3000
```

Генерация типизированного клиента после изменения API:

```bash
pnpm generate   # openapi.json + packages/api-client/src/generated/schema.ts
```
