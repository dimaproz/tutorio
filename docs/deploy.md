# Tutorio Deployment (Stage 0)

Everything below is a one-time manual setup (accounts required). The configs are already in the repo.

## 1. GitHub

1. Create a private repository, push `main`.
2. CI (`.github/workflows/ci.yml`) runs automatically: lint + typecheck + test + build on every push/PR.

## 2. Railway — API + Postgres

1. Create a project → **Deploy from GitHub repo** (this repository).
2. Add **PostgreSQL** (New → Database → Postgres). Enable backups: Database → Backups → daily.
3. In the API service (Settings):
   - Root Directory: `/` (repo root; the build is described in `railway.json`).
   - Config-as-code picks up `railway.json`: build → prisma generate → turbo build; healthcheck `/api/health`; pre-deploy → `prisma migrate deploy`.
4. API service variables:
   - `DATABASE_URL` → reference the Postgres service (`${{Postgres.DATABASE_URL}}`)
   - `JWT_ACCESS_SECRET` → generate (`openssl rand -hex 32`)
   - `JWT_REFRESH_SECRET` → generate separately (`openssl rand -hex 32`, must differ from the access secret)
   - `JWT_ACCESS_TTL=15m`, `JWT_REFRESH_TTL=30d` (optional, these are the defaults)
   - `JWT_ISSUER=tutorio-api`, `JWT_AUDIENCE=tutorio-clients` (optional, defaults)
   - `WEB_ORIGIN` → the web URL on Vercel (can be added after step 3); CORS uses this exact allowlist
   - `SENTRY_DSN` → from step 4
   - `NODE_ENV=production`
5. Verify: `https://<api-domain>/api/health` → `{"status":"ok"}`, `https://<api-domain>/docs` → Swagger.

## 3. Vercel — Web

1. Import Git Repository → this repository.
2. Root Directory: `apps/web` (Framework: Next.js — auto-detected; pnpm workspace too).
3. Environment Variables:
   - `API_URL` → `https://<api-domain>/api` (server-only; used by the Next.js auth gateway)
   - `NEXT_PUBLIC_SENTRY_DSN` → from step 4
4. After deploy, put the Vercel domain into `WEB_ORIGIN` of the API service on Railway.

## 4. Sentry

1. Create an organization + two projects: `tutorio-api` (Node/NestJS) and `tutorio-web` (Next.js).
2. Each project's DSN → Railway variables (`SENTRY_DSN`) and Vercel (`NEXT_PUBLIC_SENTRY_DSN`).
3. Init code is already in the repo (`apps/api/src/instrument.ts`, `apps/web/src/instrumentation*.ts`) — without a DSN it is simply disabled.

## 5. Local development

```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # set DATABASE_URL (a Railway dev DB works)
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @tutorio/api prisma:migrate   # first migration
pnpm dev                                    # turbo: api on :4000, web on :3000
```

Generate the typed client after changing the API:

```bash
pnpm generate   # openapi.json + packages/api-client/src/generated/schema.ts
```
