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

## Context

- MVP plan and architecture: [docs/mvp-plan.md](docs/mvp-plan.md) — read it before starting any stage.
- Deploy checklist: [docs/deploy.md](docs/deploy.md).
- Monorepo pnpm + Turborepo: `pnpm lint / typecheck / test / build` — same pipeline as CI; must be green before committing.
- Money is stored only in minor units (integers); business logic lives in `packages/domain` with unit tests (vitest).
