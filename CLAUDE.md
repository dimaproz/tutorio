# Tutorio — правила проекта

## Git / коммиты

- **Все коммиты — [Conventional Commits](https://www.conventionalcommits.org/):** `type(scope): subject`.
  - Типы: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`, `ci`, `build`, `perf`.
  - Scope — модуль/пакет: `api`, `web`, `domain`, `validation`, `api-client`, `repo`.
- **Все коммит-сообщения — только на английском.**
- Рабочая ветка — `develop`; `main` — только через PR.

## Контекст

- План MVP и архитектура: [docs/mvp-plan.md](docs/mvp-plan.md) — читать перед началом любого этапа.
- Деплой-чеклист: [docs/deploy.md](docs/deploy.md).
- Монорепо pnpm + Turborepo: `pnpm lint / typecheck / test / build` — тот же пайплайн, что и в CI; должен быть зелёным перед коммитом.
- Деньги — только в minor units (целые числа), бизнес-логика — в `packages/domain` с юнит-тестами (vitest).
