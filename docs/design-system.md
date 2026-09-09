# Tutorio Design System Contract

Last verified: 2026-09-09.

## Purpose

Tutorio uses a deliberately plain shadcn baseline for the pilot. The immediate
goal is a coherent, accessible, fully working CRM whose future visual redesign
can be implemented centrally. Product screens must not own theme decisions or
recreate common controls.

The current production pages are evidence for behavior and data requirements,
not visual references. Page composition may change when an approved work packet
defines a clearer user journey.

## Pilot baseline

- Framework: Next.js App Router, React, Tailwind CSS v4.
- Component distribution: official shadcn registry.
- Installed preset: `radix-nova`, neutral theme, CSS variables enabled.
- Headless base: Radix. Do not migrate to Base UI during pilot stabilization.
- Icons: Lucide through the configured shadcn icon library.
- Motion: the short state-driven transitions shipped with shadcn and
  `tw-animate-css`; additional animation libraries require a demonstrated
  product need and a separate decision.
- Page patterns: explicitly selected official shadcn blocks, adapted to Tutorio
  behavior and localization. A block is a starting composition, not permission
  to overwrite existing primitives or copy demo domain logic.

TailAdmin, Lovable, screenshots, and the current Tutorio page layouts are not
design authorities. The retired `/design` route must not be recreated.
Storybook becomes the executable component catalog after Frontend Packet F2.

## Source-of-truth order

When sources disagree, use this order:

1. The affected product workflow in `docs/product/`.
2. The architect-approved screen brief in the active work packet.
3. Semantic tokens in `apps/web/src/app/globals.css`.
4. Installed shadcn primitives in `apps/web/src/components/ui`.
5. Approved Tutorio compositions in `apps/web/src/components/shared` and
   application-shell components in `apps/web/src/components/app`.
6. Feature-local components in `apps/web/src/features/<domain>/ui` or the
   corresponding legacy feature folder while migration is in progress.
7. Storybook stories for supported component states.
8. The explicitly named official shadcn block or component documentation.

Existing screens may be inspected for API behavior, permissions, copy, and edge
cases, but must not silently determine a replacement screen's layout.

## Component layers

### Layer 1: shadcn primitives

Location: `apps/web/src/components/ui`.

Target contract: this directory contains official shadcn source plus only
explicitly documented and reviewed deviations. Frontend Packet F1 inventories
the current drift before enforcing this boundary. Primitives own interaction,
accessibility, theme consumption, base shape, motion, and variants.

Rules:

- Search the installed primitives and official shadcn registry before writing UI.
- Use built-in props and variants before adding another variant.
- Product and feature code must not import `radix-ui` directly.
- Do not create another Button, Card, Dialog, Select, Badge, Empty, Skeleton,
  Table, Tabs, Tooltip, Sheet, Drawer, or equivalent primitive elsewhere.
- Review upstream changes with `shadcn add --dry-run` and `--diff`; never blindly
  overwrite locally verified fixes.
- A primitive change is system-wide and requires Storybook coverage and review.

### Layer 2: shared product components

Location: `apps/web/src/components/shared`.

These are reusable Tutorio compositions without domain API calls or feature
ownership. Examples include a standard entity form shell, collection toolbar,
empty collection state, confirmation flow, and entity picker.

A new shared component is justified only when two real callers need the same
semantic purpose with stable props. Similar appearance alone is not sufficient.
Every shared component must compose Layer 1, use semantic tokens, expose a small
controlled API, and document meaningful states in Storybook.

### Approved product-component registry

This is the current semantic registry. Frontend Packet F5 may move a component
between `components/app` and `components/shared`, consolidate overlapping APIs,
or rename it, but feature pages must reuse the registered capability instead of
creating a parallel implementation.

| Capability | Current component(s) |
| --- | --- |
| Page structure and navigation | `PageShell`, `BackButton`, `DetailView` |
| Collection controls and data display | `CollectionToolbar`, `ListControls`, `DataTable` |
| Loading and empty states | `LoadingRegion`, `LoadingPanel`, `CollectionEmptyState` |
| Form composition | `EntityFormDialog`, `FormSection`, `FormActions` |
| Confirmation and row actions | `ConfirmDialog`, `RowActionsTrigger` |
| Entity selection | `EntityPicker`, `EntityMultiSelect` |
| People and identity | `EntityAvatar`, `PersonMiniCard` |
| Status presentation | `StatusBadge`, `StatusSelect` |
| Money and metrics | `MoneyInput`, `MetricCard`, `StatTile` |
| Date and schedule input | `DatePicker`, `AppointmentPicker`, `WeekdayPicker` |

Registration records reuse intent; it does not certify the component's current
visual implementation. F1-F5 bring registered components into the new contract.

### Layer 3: application shell

Location: `apps/web/src/components/app`.

This layer owns authenticated navigation, header, user menu, workspace context,
and page shell. It may compose Layers 1 and 2 but must not contain entity API
logic. Frontend Packet F4 will rebuild it from the official `dashboard-01`
structure and shadcn Sidebar primitives.

### Layer 4: feature components

Target location: `apps/web/src/features/<domain>/ui`.

Feature components may know domain types and compose lower layers. Components
such as `GroupCard` and `StudentCard` live once in their owning feature and are
reused by all relevant screens. A second visual clone is forbidden; meaningful
display differences use explicit variants on the owning component.

Do not create a universal entity abstraction until at least two feature
components demonstrate the same stable behavior, not merely a similar shape.

### Layer 5: routes and screens

`src/app` contains routing and Next.js composition only. A screen assembles
approved feature and shared components. It does not define reusable visual
primitives, fetch transformations, or page-specific theme values.

## Screen brief requirement

Before an agent changes a page, the active work packet must record:

1. Primary user job and one obvious primary action.
2. Required information hierarchy and progressive disclosure.
3. Explicit official shadcn block reference, if one is used.
4. Installed primitives and existing product/feature components to compose.
5. Desktop and mobile structure.
6. Loading, empty, error, disabled, success, destructive, and permission states.
7. Ukrainian and English copy requirements.
8. API/domain constraints that the UI must not reinterpret.
9. Interaction, accessibility, and visual acceptance evidence.

The agent may propose a different composition when the work packet permits it.
It must explain the user-flow improvement and still reuse approved components.

## Theme contract

Feature and screen code uses semantic utilities such as `bg-background`,
`text-foreground`, `text-muted-foreground`, `bg-card`, `border-border`,
`bg-primary`, and `text-destructive`.

Raw hex values, Tailwind color families, one-off shadows, page-owned radii, and
manual dark-mode colors are forbidden outside:

- semantic definitions in `globals.css`;
- documented user-provided colors, such as a teacher color;
- temporary Storybook token demonstrations.

The pilot baseline keeps official shadcn theme values. Tutorio may retain only
domain semantics missing from the default theme, such as `success` and
`warning`. Workspace branding must remain isolated from core component tokens
until a later theming decision explicitly defines its behavior.

A future redesign should normally touch only:

1. semantic values in `globals.css`;
2. intentional variants in `components/ui`;
3. shared product compositions;
4. Storybook baselines.

Feature pages should not require color, radius, shadow, typography, or motion
edits during a theme change.

## Storybook contract

Storybook replaces the former `/design` component lab. It is a development and
test dependency, not a production route.

Stories are required for:

- any locally changed shadcn primitive;
- every approved shared product component;
- application-shell components with meaningful responsive states;
- reusable feature components such as entity cards;
- hard-to-reach loading, empty, error, permission, destructive, and long-copy
  states.

Do not duplicate every official shadcn documentation example. Document the
components and states that Tutorio owns or relies on as a product contract.

## Required agent workflow

Before writing JSX, an agent must:

1. Read the affected product workflow and active screen brief.
2. Name the screen pattern and primary action.
3. Search `components/ui`, `components/shared`, `components/app`, and the owning
   feature, in that order.
4. Inspect relevant Storybook stories and the explicitly named official shadcn
   block/component.
5. List the existing components it will compose.
6. State why any proposed new component is not a duplicate.

When a new shared component is genuinely required, the same change must define
its semantic purpose and stable API, add stories for meaningful states, add
interaction tests where behavior exists, and register it in this document.

## Definition of done for frontend work

- The screen follows its approved brief; the previous layout was not copied by
  default.
- Approved shadcn, shared, and feature components are reused.
- No duplicate primitive, raw product color, or page-specific theme was added.
- Required runtime states are represented and tested.
- Desktop/mobile, light/dark, and Ukrainian/English are verified.
- Changed owned components have current Storybook stories.
- Web lint, typecheck, unit/interaction tests, and application build pass without
  warnings. Storybook stories and its static build are additionally mandatory
  after Frontend Packet F2; before F2, missing Storybook is a tracked foundation
  gap and must not be replaced with another production component-lab route.

See [`frontend-plan.md`](./frontend-plan.md) for the migration sequence.
