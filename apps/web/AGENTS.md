# Web Application Contract

Read this file before changing `apps/web`. The root `CLAUDE.md` contains
monorepo-wide rules; this document owns the web application architecture.

## Architecture

`src/app` is routing and Next.js composition only. A route may import one
public feature entry point plus shared layout code; it must not contain domain
UI, queries, forms, or business transformations.

```text
src/
  app/                 # routes, layouts, Next.js special files
  features/<domain>/   # api/, model/, ui/, index.ts
  components/ui/       # shadcn primitives only
  components/shared/   # reusable product UI without domain API/types
  lib/                 # cross-cutting infrastructure only
```

Dependencies flow in one direction: `app -> features/shared`,
`features -> shared/own feature`, and `shared -> ui/lib`. Shared code never
imports a feature. A feature exposes only `index.ts`; another feature imports
that public entry point rather than its internal files.

## Before Writing UI

For every new UI requirement, inspect in this exact order:

1. `components/ui` for an installed shadcn primitive or variant.
2. `components/shared` for an approved product pattern.
3. The current feature for a local pattern.
4. `/design` for the visual contract.

Use TailAdmin only when the local design catalog has no approved pattern.
Compose existing components; do not recreate cards, alerts, empty states,
buttons, dialogs, tables, form fields, or loading placeholders with styled
`div`s.

Create a shared component only after two real callers have the same semantic
purpose and stable props. Otherwise keep it in the feature. Shared components
must be controlled where their state needs coordination: their closest common
parent owns the state and receives change callbacks.

`EntityPicker` / `EntityMultiSelect` are the standard controls for choosing a
person-like entity (student, parent, teacher) in a form or a filter. Supply an
avatar key and display name for every option; do not introduce a second custom
combobox for the same purpose. The feature owns loading and server-side search
when its entity collection outgrows the picker page.

## UI and Styling

- Use shadcn variants and semantic Tailwind tokens (`bg-primary`,
  `text-muted-foreground`, `border-border`). Do not use raw Tailwind colour
  families, hex colours, or ad-hoc `dark:` overrides outside token definitions,
  design demos, or user-provided data colours.
- Lifecycle labels must use semantic `Badge` variants (`primary`, `secondary`,
  `success`, `warning`, `destructive`) from `components/ui/badge`. Map domain
  states to those roles; do not create a parallel status palette, status
  `<span>` elements, or inline `backgroundColor` / `color` styles.
- The only approved semantic accents are `neutral`, `primary`, `success`,
  `warning`, and `destructive`.
- Use `gap-*`, not `space-x-*` or `space-y-*`; use `size-*` for square items;
  use `cn()` for conditional classes.
- Every dialog, sheet, and drawer has a title. Dialogs use the shared shell:
  fixed header, scrollable body, fixed action footer, loading skeleton.
- New product copy goes through `next-intl`. Do not duplicate status labels,
  error mappings, currency metadata, or formatting rules in components.

## Forms and Features

- Keep schemas, defaults, UI-only types, and DTO mappers in the feature's
  `model` directory. Shared form helpers may not contain entity schemas.
- A form orchestrator owns `useForm`, submission, and mutation state. It uses
  `FormProvider`; visual sections consume form context and do not call APIs.
- Use `useWatch` for the specific fields a section needs; do not call
  `form.watch()` for the entire form.
- A JSX component has one role and stays below 300 lines. Split larger files
  into sections, hooks, and model modules. A documented exception is required
  for generated shadcn components or a justified technical boundary.

## Definition of Done

- Run `pnpm --filter @tutorio/web lint`, `typecheck`, `test`, and `build`.
  Warnings are failures; document the smallest possible lint exception only
  for a verified third-party limitation.
- Add tests for feature model changes and interaction tests for dialogs/forms.
- Update `/design` when adding or changing a shared pattern. Verify desktop,
  mobile, light/dark theme, and both product locales for visual changes.
