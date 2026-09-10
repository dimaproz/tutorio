# Tutorio Design System Contract

Last verified: 2026-09-10.

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
- Installed preset: `radix-luma` from preset `b1Gwk6B7o`, with the Stone base,
  Blue theme, Amber chart palette, default radius, default/solid menu, subtle
  menu accent, and CSS variables enabled.
- Typography exception: Geist and Geist Mono remain the application fonts;
  the preset's Inter font selection is intentionally not applied.
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
Storybook is the executable component catalog for approved UI contracts.

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

Use leaf imports as the stable convention: `@/components/shared/<component>`.
Feature barrels (`@/features/<domain>`) are the stable route boundary; legacy
`components/<domain>` modules remain feature-owned until their individual page
migration. Shared components may be consumed by features and the shell, never
the reverse.

| Semantic purpose                         | Owner and import                                                                                                                                               | Stable props / slots                                                                           | Allowed consumers                   | Story                                                           |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------- |
| Collection layout and states             | `CollectionFrame` — `@/components/shared/collection-frame`                                                                                                     | `header`, `toolbar`, `refresh`, `loading`, `error`, `empty`, `desktop`, `mobile`, `pagination` | Feature list screens                | `Shared/Reference compositions`                                 |
| Collection controls and empty state      | `CollectionToolbar`, `CollectionEmptyState` — `@/components/shared/collection-toolbar`, `collection-empty-state`                                               | child/action slots; no queries or entity types                                                 | Feature list screens                | `Shared/CollectionToolbar`, `Shared/Reference compositions`     |
| Generic table and URL list controls      | `DataTable`, `ListSearchInput`, `ListPagination`, `ListSelectFilter` — `@/components/shared/data-table`, `list-controls`                                       | typed columns/data/sort; localized labels supplied by caller                                   | Feature list/detail tables          | `Shared/Reference compositions`                                 |
| Detail layout                            | `DetailFrame` — `@/components/shared/detail-frame`                                                                                                             | `back`, `identity`, `main`, `aside`, `loading`, `error`                                        | Feature detail screens              | `Shared/Reference compositions`                                 |
| Detail identity helpers                  | `BackButton`, `EntityAvatar`, `PersonMiniCard`, `ProfileHeader`, `InfoRow` — `@/components/shared/*`                                                           | localized labels and identity data supplied by caller                                          | Feature screens and pickers         | `Shared/Reference compositions` / `Shared/EntityPicker`         |
| Form overlay                             | `EntityFormDialog` — `@/components/shared/entity-form-dialog`                                                                                                  | controlled `open`, title/description, `sm`/`md`/`lg`, scrollable body, persistent `footer`     | Feature-owned forms                 | `Shared/EntityFormDialog`                                       |
| Form and confirmation actions            | `FormSection`, `FormActions`, `ConfirmDialog` — `@/components/shared/*`                                                                                        | field content/action slots; mutation state supplied by caller                                  | Feature forms and destructive flows | `Shared/FormSection and FormActions`, `Shared/EntityFormDialog` |
| Status presentation                      | `StatusBadge`, `StatusSelect` — `@/components/shared/status-badges`, `status-select`                                                                           | `label`, semantic `tone`, optional icon / mapped options                                       | Feature/domain adapters only        | `Shared/Reference compositions`                                 |
| Entity input and reusable value controls | `EntityPicker`, `AvatarPicker`, `MoneyInput`, `DurationInput`, `TimezoneCombobox`, `DatePicker`, `AppointmentField`, `WeekdayPicker` — `@/components/shared/*` | controlled values and localized labels; no API calls                                           | Feature forms                       | `Shared/EntityPicker`, `Shared/Value controls`                  |
| Entity metrics                           | `MetricCard` — `@/components/shared/metric-card`                                                                                                               | label, value, optional description/icon                                                        | Feature detail sections             | `Shared/Reference compositions`                                 |

The generic status contract deliberately has no validation DTO import. Each
domain adapter maps its lifecycle DTO and localized copy locally. `MetricCard`
is a reusable entity/detail metric; the dashboard-only `StatTile` remains in
`features/dashboard` and is not a competing shared contract.

#### Reference compositions

- Collection: compose `PageHeader`, `CollectionToolbar`, refresh/error/loading
  feedback, desktop table, feature-owned mobile cards, `CollectionEmptyState`,
  and pagination through `CollectionFrame`. The frame never owns queries,
  columns, card content, filters, or API types.
- Detail: compose `BackButton`, a feature-owned identity area (Avatar, title,
  status, metadata, primary and overflow actions), and main/aside slots through
  `DetailFrame`. It collapses to one column below `lg`; loading/error remain
  feature slots.
- Form overlay: use `EntityFormDialog` with an accessible title/description,
  `FieldGroup`/`Field` (and `FieldSet`/`FieldLegend` when grouping matters), a
  scrollable body, and stable `FormActions` footer. Feature forms own
  validation, mutation error, pending, disabled, and destructive semantics.

### Layer 3: application shell

Location: `apps/web/src/components/app`.

This layer owns authenticated navigation, header, user menu, workspace context,
and page shell. It may compose Layers 1 and 2 but must not contain entity API
logic. Frontend Packet F4 will rebuild it from the official `dashboard-01`
structure and shadcn Sidebar primitives.

`components/app/session-provider` is the one documented dependency exception:
feature code reads authenticated workspace context from this provider, but does
not render shell UI. The architecture check permits that exact import only. The
root `app/layout` is the other technical exception: it installs global UI
providers such as the shadcn Sonner host before any route composition begins.

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
feature barrels; features compose approved shared components. Routes do not define reusable visual
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
`warning`. Narrow token corrections are permitted when automated accessibility
tests prove that an upstream preset value misses the required contrast; the
current baseline corrects the light destructive and dark primary pairs for this
reason. Workspace colour customization is not a pilot capability. Adding it
again requires a separate decision that defines its data contract and keeps it
isolated from core component tokens.

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
- Web lint, typecheck, unit/interaction tests, application build, Storybook
  browser tests, and the Storybook static build pass. Storybook coverage is
  mandatory for every changed owned component.

See [`frontend-plan.md`](./frontend-plan.md) for the migration sequence.
