# Tutorio Design System Contract

## Purpose

Tutorio's interface must be inexpensive to restyle, theme, and extend. Product
screens are assembled from a small set of reusable components. Visual decisions
live in semantic tokens and shared variants, never in individual screens.

This document is the human-readable source of truth. The executable reference
is the `/design` route, and agent enforcement lives in `apps/web/AGENTS.md`.

## Source-of-truth order

When sources disagree, use this order:

1. Semantic tokens in `apps/web/src/app/globals.css`.
2. Installed shadcn primitives in `apps/web/src/components/ui`.
3. Approved Tutorio compositions in `apps/web/src/components/shared` and
   `apps/web/src/components/app`.
4. Feature-local compositions in `apps/web/src/components/<domain>`.
5. Visual examples on `/design`.
6. TailAdmin as an external reference only when no local pattern exists.

A production screen must not copy styling from a screenshot or TailAdmin
directly when an approved local component already represents the same purpose.

## Component layers

### Layer 1: shadcn primitives

Location: `apps/web/src/components/ui`.

These components own interaction, accessibility, base shape, and variants:
`Button`, `Card`, `Badge`, `Table`, `Dialog`, `Sheet`, `Drawer`, `Tabs`,
`Field`, `Input`, `Select`, `Command`, `Empty`, `Alert`, `Skeleton`, `Spinner`,
`Tooltip`, and the other installed shadcn components.

Rules:

- Prefer built-in props and variants before adding classes.
- Do not fork a second primitive with the same semantic purpose.
- Update an installed primitive only when the change should affect every
  product use of that primitive.

### Layer 2: Tutorio product components

Locations: `apps/web/src/components/shared` and
`apps/web/src/components/app`.

These components encode reusable Tutorio meaning while remaining independent
of a domain API. They are the default building blocks for screens.

| Need | Approved component |
| --- | --- |
| Page title and primary action | `PageHeader` |
| Query refresh and retry feedback | `QueryRefreshIndicator`, `QueryErrorAlert` |
| Server-side table | `DataTable` |
| List filters, search, sorting, pagination | `ListControls`, `CollectionToolbar` |
| Empty collection | `CollectionEmptyState` |
| Loading region or panel | `LoadingRegion`, `LoadingPanel` |
| Standard form dialog | `EntityFormDialog` |
| Form grouping and footer actions | `FormSection`, `FormActions` |
| Destructive confirmation | `ConfirmDialog` |
| Row action menu | `RowActionsTrigger` |
| Person selection | `EntityPicker`, `EntityMultiSelect` |
| Person identity | `EntityAvatar`, `PersonMiniCard`, `ProfileHeader` |
| Profile metadata | `InfoRow`, `ProfileTag`, `SectionTitle` |
| Domain status display and selection | `StatusBadge`, `StatusSelect`, status metadata maps |
| Money entry and display | `MoneyInput`, shared currency metadata, `MetricCard` |
| Date and appointment entry | `DatePicker`, `AppointmentPicker` |
| Repeated weekday entry | `WeekdayPicker` |
| Small statistics | `StatTile`, `MetricCard` |

Before creating a new product component, search both approved locations and the
current feature. A new shared component is justified only after two real screens
need the same semantic purpose with stable props.

### Layer 3: feature components

Locations: `apps/web/src/components/students`, `parents`, `groups`, `teachers`,
`packages`, `scheduling`, and `settings` while the feature migration is active.

Feature components may compose Layers 1 and 2 and may know domain types. They
must not introduce a new visual language. A repeated feature pattern moves to
Layer 2 after its second real caller appears.

## Theme contract

### Semantic tokens only

Product components use semantic utilities:

- surfaces: `background`, `card`, `popover`, `muted`, `accent`;
- text: `foreground`, `muted-foreground`;
- borders and focus: `border`, `input`, `ring`;
- actions: `primary`, `secondary`, `destructive`;
- statuses: `success`, `warning`, `destructive`, and neutral;
- charts: `chart-1` through `chart-5`;
- workspace brand: `workspace-primary`, `workspace-secondary`.

Raw hex values, Tailwind colour families, and inline colour styles are forbidden
in product screens. Exceptions are limited to:

- token definitions in `globals.css`;
- user-provided colours, such as a teacher colour;
- `/design` swatches that document an actual token;
- isolated theme-preview code that does not style production UI.

### Theme changes

A visual theme change should normally touch only:

1. semantic values in `globals.css`;
2. primitive variants in `components/ui` when shape or interaction changes;
3. `/design` examples and visual regression evidence.

Feature screens should not require editing for a colour, radius, typography,
shadow, or dark-mode change. If they do, the style has leaked past the design
system boundary and should be moved into a token or shared component.

## Composition rules

- Build pages from approved components, not styled generic `div` elements.
- Use `Card` composition for card content and `Empty`, `Alert`, `Skeleton`, and
  `Badge` for their respective purposes.
- Use `FieldGroup`, `Field`, and related shadcn form components for forms.
- Use semantic component variants. `className` is for layout and responsive
  composition, not for replacing component colour or typography.
- Use `gap-*`, not `space-x-*` or `space-y-*`; use `size-*` for squares.
- Use Lucide icons through the installed icon library. Icon-only actions need an
  accessible name and a tooltip when their meaning is not universally obvious.
- Every dialog, sheet, and drawer has an accessible title.
- New user-facing copy goes through `next-intl`.

## Required agent workflow

Before writing JSX, an agent must:

1. Name the screen pattern and the user's primary action.
2. Search `components/ui`, then `components/shared`, then `components/app`, then
   the current feature.
3. Inspect the matching `/design` example.
4. List the existing components it will compose.
5. Create a new component only when no approved component fits.

When a new shared component is genuinely required, the same change must:

1. define its semantic purpose and stable API;
2. use only semantic tokens and shadcn primitives;
3. add all meaningful states to `/design`;
4. add tests where interaction or state mapping exists;
5. add it to the approved component table in this document.

## Definition of done for visual work

- The page uses approved primitives and product components.
- No duplicated component or ad-hoc token was introduced.
- Default, loading, empty, error, disabled, success, and destructive states are
  represented where relevant.
- Desktop and mobile, light and dark, Ukrainian and English are checked.
- `/design` is updated for every changed shared pattern.
- Web lint, typecheck, test, and build pass without warnings.

## Stabilization tasks

The current system already has the right foundation. Stage 4.1 must finish the
following consolidation before feature expansion:

1. Remove duplicated or superseded root token declarations from `globals.css`.
2. Decide whether `components/app` remains the permanent product-component
   layer or is migrated into `components/shared`; do not create a third layer.
3. Add import examples, usage guidance, and state coverage to `/design` for the
   approved product components above.
4. Add an automated check for raw product colours and obvious duplicate
   primitives outside the documented exceptions.
5. Refactor one list screen, one detail screen, and one form dialog as reference
   compositions, then use them as templates for the remaining domains.
