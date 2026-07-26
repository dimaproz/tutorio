# Tutorio — Stage Development Plans

Per-stage engineering plans that translate the product roadmap
([../product vision](../mvp-plan.md) and the strategy artifact) into concrete,
buildable slices. Each file is one vertical slice that ends deployed to the dev
environment.

## How to read this folder

- Stages **0–3.6 are done** (see [../mvp-plan.md](../mvp-plan.md)); they are not
  re-documented here.
- Numbering continues the repo convention (`feature/stage-N-*` branches).
- **Progressive elaboration:** near-term stages (3.7, 4) are specified in full
  implementation detail. Later stages are specified at "ready to start" depth —
  goal, model deltas, module surface, endpoints, risks — and are deepened as we
  approach them, because their detail will shift once the stages before them
  land. Do not treat a later stage's lighter section as "less important" — treat
  it as "not yet frozen".

## Stage index

| Stage | Name | Pillar | Status |
|-------|------|--------|--------|
| [3.7](./stage-3.7-ux-hardening.md) | UX hardening — "usable today" | Scheduling | ✅ Done |
| [4](./stage-4-packages-ledger-payments.md) | Packages, credit ledger, payments | Money | ✅ Done |
| [4.5](./stage-4.5-leads-crm.md) | Leads / CRM funnel | Growth | Planned |
| [5](./stage-5-dashboard-analytics-telegram.md) | Dashboard, analytics, Telegram | Growth | Planned |
| [6](./stage-6-progress-tracking.md) | Learning progress tracking | Student | Planned |
| [7](./stage-7-public-student-page.md) | Public student page (token) | Student | Planned |
| [8](./stage-8-receipts-branding-settings.md) | Receipts, branding, workspace settings | Money | Planned |
| [9](./stage-9-import-pilot.md) | CSV import, SpeakWise pilot, GDPR | Ops | Planned |
| [10](./stage-10-student-portal.md) | Student portal (accounts, grades, progress) | Student | Vision |

## Engineering conventions (apply to every stage)

These are the invariants every stage plan assumes. They are not repeated inside
each file.

### Architecture & layering
- **Monorepo boundaries:** pure business rules in `packages/domain` (no I/O,
  vitest-first); shared Zod DTOs in `packages/validation`; generated client in
  `packages/api-client`. `apps/api` (NestJS) orchestrates persistence; `apps/web`
  (Next.js) is presentation.
- **Web feature-slice contract** ([../../apps/web/AGENTS.md](../../apps/web/AGENTS.md)):
  `features/<domain>/{api,model,ui,index.ts}`. A route imports one feature entry
  point. `model/` owns Zod schemas, defaults, DTO mappers; a form orchestrator
  owns `useForm`; sections consume `FormProvider` and never call APIs.
- **API module shape** (matches existing `students`/`groups`/`scheduling`):
  `dto/*.dto.ts`, `*.controller.ts`, `*.service.ts`, `*.module.ts`,
  `*.service.spec.ts`. Services are `@Injectable`, constructor-injected, throw
  typed errors from `common/business.errors.ts`. Controllers stay thin and
  documented with Swagger decorators (feeds `api-client` generation).

### Cross-cutting rules
- **Every business table carries `workspaceId`** + composite indexes; all queries
  are workspace-scoped. Auth via `AccessTokenGuard`; owner-only surfaces gated by
  `RolesGuard` + `@Roles('OWNER')`.
- **Writes that mutate business data run in a Prisma transaction that also writes
  the `AuditLog`** (the established audit-in-transaction pattern).
- **Money is integer minor units**; currency never summed across currencies.
- **Ledger-style entities are append-only**: corrections are compensating
  entries, never edits/deletes. Idempotency keys guard against double-writes.
- **Soft delete (`deletedAt`)** everywhere except `Student`/`Parent` (hard delete
  — decision #7 in mvp-plan).
- **i18n:** all new copy goes through `next-intl` with uk + en key parity. No
  English/Ukrainian strings in components.

### Design sourcing (mandatory, per feature)
Before building any UI, find the closest pattern in **TailAdmin** and reproduce
its look/behaviour on our shadcn/ui + Tailwind stack:
- Components: https://react.tailwind-admin.com/
- Dashboard/analytics patterns: https://demo.tailadmin.com/analytics

Then check the local `/design` lab and `components/` for an existing adaptation
before writing new UI. This is part of the Definition of Done.

### Definition of Done (every stage)
- `pnpm lint typecheck test build` green across all affected packages (warnings
  are failures).
- Domain changes covered by vitest; API changes covered by service unit tests +
  a supertest smoke for the critical flow; dialogs/forms have interaction tests.
- `api-client` regenerated from Swagger; web consumes the typed client.
- `/design` updated if a shared pattern changed; verified desktop + mobile,
  light + dark, uk + en.
- A working slice is deployed to the dev environment.
