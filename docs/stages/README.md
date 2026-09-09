# Tutorio — Stage Development Plans

Per-stage engineering plans that translate the product roadmap
([../MVP contract](../mvp-plan.md) and [../execution roadmap](../roadmap.md)) into concrete,
buildable slices. Each file is one vertical slice that ends deployed to the dev
environment.

## How to read this folder

- Stages **0–4 are implemented** but not yet pilot-safe. Stage 4.1 is the active
  correctness, workflow, and operational gate before new feature modules start.
- Numbering continues the repo convention (`feature/stage-N-*` branches).
- Completed stage files are historical implementation briefs. When their
  assumptions differ from an ADR, domain guide, or current-state checkpoint,
  the newer source of truth wins and the discrepancy should be corrected.
- **Progressive elaboration:** active Stage 4.1 is specified at execution depth.
  Deferred stages preserve product hypotheses and architecture notes, but they
  are not ready-to-start commitments and must be reframed from pilot evidence
  before implementation.

## Stage index

| Stage | Name | Pillar | Status |
|-------|------|--------|--------|
| [3.7](./stage-3.7-ux-hardening.md) | UX hardening — "usable today" | Scheduling | ✅ Done |
| [4](./stage-4-packages-ledger-payments.md) | Packages, credit ledger, payments | Money | ✅ Done |
| [4.1](./stage-4.1-stabilization.md) | Pilot core stabilization | Foundation | Active |
| [5](./stage-5-dashboard-analytics-telegram.md) | 5A action centre + Telegram; 5B analytics | Operations | Deferred; select from pilot evidence |
| [6](./stage-6-progress-tracking.md) | Learning progress tracking | Student | Deferred; select from pilot evidence |
| [7](./stage-7-public-student-page.md) | Public student page (token) | Student | Deferred; select from pilot evidence |
| [8](./stage-8-receipts-branding-settings.md) | Receipts, branding, workspace settings | Money | Deferred; select from pilot evidence |
| [9](./stage-9-import-pilot.md) | Pilot graduation and import expansion | Ops | Planned after core pilot |
| [9.5](./stage-4.5-leads-crm.md) | Leads / CRM funnel (historical filename) | Growth | Deferred post-pilot |
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
- **Archive-first lifecycle:** follow [ADR 0002](../decisions/0002-record-lifecycle-and-deletion.md).
  Hard deletion is owner-only and limited to unused records without business
  history; financial/audit history is preserved.
- **i18n:** all new copy goes through `next-intl` with uk + en key parity. No
  English/Ukrainian strings in components.

### Design sourcing (mandatory, per feature)
Before building any UI, read the architect-approved screen brief required by
[ADR 0005](../decisions/0005-shadcn-frontend-foundation.md). Inspect installed
shadcn primitives, approved Tutorio compositions, Storybook stories, and the
explicitly named official shadcn block in that order. Current product pages are
behavior references, not visual templates. This is part of the Definition of
Done.

### Definition of Done (every stage)
- Root `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` green across
  all affected packages (warnings are failures). Run API E2E separately against
  an isolated database.
- Domain changes covered by vitest; API changes covered by service unit tests +
  a supertest smoke for the critical flow; dialogs/forms have interaction tests.
- `api-client` regenerated from Swagger; web consumes the typed client.
- Storybook stories updated if an owned shared pattern changed; verified desktop
  + mobile, light + dark, uk + en.
- A working slice is deployed to the dev environment.
