# Tutorio — Project Rules

## Language

- **Everything in the repository is written strictly in English**: code comments, documentation, commit messages, README files, config comments, TODO notes.
- The product UI itself is localized (Ukrainian + English via next-intl) — locale files are the only place where non-English text is allowed.

## Git / Commits

- **All commits follow [Conventional Commits](https://www.conventionalcommits.org/):** `type(scope): subject`.
  - Types: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`, `ci`, `build`, `perf`.
  - Scope = module/package: `api`, `web`, `domain`, `validation`, `api-client`, `repo`.
- **All commit messages are in English only.**
- Working branch is `develop`; `main` is updated only via PR.

## Design / UI

- **The official shadcn registry is the pilot UI baseline.** Use the installed
  `radix-nova` preset, semantic Tailwind tokens, and the project's Lucide icon
  library. Do not introduce another primitive library or visual system.
- Use https://ui.shadcn.com/docs/components for primitives and
  https://ui.shadcn.com/blocks for page-level starting points. Authentication
  and application-shell work must adapt an explicitly named official shadcn
  block instead of recreating the pattern from scratch.
- Existing Tutorio screens preserve product behavior and data requirements, but
  their current layout and visual composition are not design authority. Every
  screen migration starts with an architect-approved brief defining the user
  job, information hierarchy, shadcn block/primitives, reusable product
  components, responsive behavior, and required states.
- Storybook is the executable catalog for approved product components. Changed
  owned components must update their stories in the same change. The former
  `/design` route is retired.

The mandatory component hierarchy, theme boundary, and agent workflow are
defined in [docs/design-system.md](docs/design-system.md). Read it before any
frontend visual work. Product screens must compose installed shadcn primitives
and approved Tutorio product components; do not create a parallel primitive,
raw colour, one-off card, custom empty state, or custom dialog shell.

## Context

- Documentation map and precedence: [docs/README.md](docs/README.md) — use it to
  resolve scope, lifecycle, and roadmap questions.
- Active checkpoint: [docs/current-state.md](docs/current-state.md) — read it first before planning work.
- MVP plan and architecture: [docs/mvp-plan.md](docs/mvp-plan.md) — read it before starting any stage.
- System boundaries and vocabulary: [docs/architecture.md](docs/architecture.md)
  and [docs/glossary.md](docs/glossary.md).
- Execution order: [docs/roadmap.md](docs/roadmap.md).
- Active implementation queue: [docs/next-work.md](docs/next-work.md).
- Entity lifecycle and relationships: [docs/domain/README.md](docs/domain/README.md)
  — read the affected aggregate before changing its schema, service, API, or UI.
- Cross-entity user journeys: [docs/product/README.md](docs/product/README.md) —
  read the affected workflow before changing pilot-critical forms or actions.
- Durable decisions: [docs/decisions/README.md](docs/decisions/README.md).
- Pilot release evidence: [docs/quality/pilot-acceptance.md](docs/quality/pilot-acceptance.md).
- Deploy checklist: [docs/deploy.md](docs/deploy.md).
- Monorepo pnpm + Turborepo: `pnpm lint / typecheck / test / build` must be green
  before committing. API E2E is a separate command and must use an isolated database.
- Money is stored only in minor units (integers); business logic lives in `packages/domain` with unit tests (vitest).
