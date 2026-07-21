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

- **TailAdmin is the design reference for the whole product.** Its React kit is
  the single source of truth for how components look and behave:
  - Component gallery: https://react.tailwind-admin.com — check here **first**
    when building or restyling any component (buttons, forms, tables, badges,
    modals, charts, etc.).
  - Application examples: https://react.tailwind-admin.com/apps — look here for
    larger patterns and full-screen solutions (dashboards, calendars, inboxes,
    kanban, profiles, wizards) before inventing a new layout.
- Reproduce TailAdmin's **visual style** (brand `#465FFF`, Untitled-UI grey
  scale, `rounded-2xl` cards with soft shadows, Outfit-like type) on our own
  **shadcn/ui + Tailwind** stack. Match the look and behaviour; do not copy
  TailAdmin source code verbatim.
- The `/design` route (`apps/web/src/app/design`) is the living component lab and
  reference implementation of this style — keep new components consistent with it.

## Context

- MVP plan and architecture: [docs/mvp-plan.md](docs/mvp-plan.md) — read it before starting any stage.
- Deploy checklist: [docs/deploy.md](docs/deploy.md).
- Monorepo pnpm + Turborepo: `pnpm lint / typecheck / test / build` — same pipeline as CI; must be green before committing.
- Money is stored only in minor units (integers); business logic lives in `packages/domain` with unit tests (vitest).
