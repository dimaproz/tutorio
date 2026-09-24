# Tutorio Design System Contract

Last verified: 2026-09-23.

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

| Semantic purpose                         | Owner and import                                                                                                                                                  | Stable props / slots                                                                                                                                                                                                                                                          | Allowed consumers                                | Story                                                                                                         |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Collection layout and states             | `CollectionFrame` — `@/components/shared/collection-frame`                                                                                                        | `header`, `toolbar`, `refresh`, `loading`, `error`, `empty`, `desktop`, `mobile`, `pagination`                                                                                                                                                                                | Feature list screens                             | `*/Screens/Collection`                                                                                        |
| Generic table and URL list controls      | `DataTable`, `ListPagination`, `ListSelectFilter` — `@/components/shared/data-table`, `list-controls`                                                             | typed columns/data/sort, `rowHeight` fixed/auto; localized labels supplied by caller                                                                                                                                                                                          | Feature list/detail tables                       | `*/Screens/Collection`                                                                                        |
| Detail layout                            | `DetailFrame` — `@/components/shared/detail-frame`                                                                                                                | `back`, `identity`, `main`, `aside`, `loading`, `error`, `ratio` default/balanced                                                                                                                                                                                             | Feature detail screens                           | `*/Screens/Page`, `*/Screens/Profile`                                                                         |
| Detail identity helpers                  | `BackButton`, `EntityAvatar`, `PersonMiniCard`, `SectionTitle` — `@/components/shared/*`                                                                          | localized labels and identity data supplied by caller                                                                                                                                                                                                                         | Feature screens and pickers                      | `*/Screens/*` / `Shared/Form/EntityPicker`                                                                    |
| Form overlay                             | `EntityFormDialog` — `@/components/shared/entity-form-dialog`                                                                                                     | controlled `open`, title/description, `sm`/`md`/`lg`, scrollable body, persistent `footer`                                                                                                                                                                                    | Feature-owned forms                              | `Shared/Dialogs/EntityFormDialog`                                                                             |
| Form and confirmation actions            | `FormSection`, `FormActions`, `ConfirmDialog` — `@/components/shared/*`                                                                                           | field content/action slots; mutation state supplied by caller                                                                                                                                                                                                                 | Feature forms and destructive flows              | `Shared/Form/FormSectionHeader`, `Shared/Dialogs/EntityFormDialog`, `Shared/Dialogs/ConfirmDialog`            |
| Status presentation                      | `StatusBadge` — `@/components/shared/status-badges`                                                                                                               | `label`, semantic `tone`, optional icon                                                                                                                                                                                                                                       | Feature/domain adapters only                     | `*/Screens/*`                                                                                                 |
| Entity input and reusable value controls | `EntityPicker`, `AvatarPicker`, `TimezoneCombobox`, `WeekdayPicker` — `@/components/shared/*`                                                                     | controlled values and localized labels; no API calls; `EntityPicker` `appearance` pill/field with `icon`; `WeekdayPicker` `appearance` default/pills                                                                                                                          | Feature forms                                    | `Shared/Form/EntityPicker`, `Shared/Form/WeekdayPicker`, `Shared/Form/OptionList`, `Shared/Form/AvatarPicker` |
| Entity metrics, Studio                   | `StatBlock` — `@/components/shared/stat-block`                                                                                                                    | `type` amount/date/chart/custom, `tone` surface/tint/accent/ink, `size` md/sm, label, caption, detail, badge, footer action                                                                                                                                                   | Feature list and detail screens                  | `Shared/Cards/StatBlock`                                                                                      |
| Lesson list rows                         | `DateTile`, `LessonItem`, `SectionDivider` — `@/components/shared/date-tile`, `lesson-item`, `section-divider`                                                    | date parts, title, meta, status and action slots, `state` next/default/past, `compact` (phones: no menu, shorter meta), `onSelect` + `selectLabel` (the whole row is one button; a row menu stays clickable above it)                                                         | Lesson lists in any feature                      | `Shared/Lists/*`                                                                                              |
| Scrolling lesson list                    | `LessonList` — `@/components/shared/lesson-list`                                                                                                                  | header as kind tabs or a title with meta, header action, grouped `LessonItem`s, fixed `maxHeight` with an inner scroll, shown/total counter, `onLoadMore`, `loading`, `empty`, `compact`; rows open through their `onSelect` on every width (the lesson panel), `framed`      | Student profile, group page                      | `Shared/Lists/LessonList`                                                                                     |
| Attendance grid                          | `AttendanceList` — `@/components/shared/attendance-list`                                                                                                          | title, window label, stat tiles, rows of cells present/absent/excused/cancelled/none with rate, note and `tone` default/risk/hold, `visibleRows` + `onShowAll`, `compact`, `empty`                                                                                            | Group page; lesson screen next                   | `Shared/Lists/AttendanceList`                                                                                 |
| Person rows and credits                  | `PersonItem`, `PersonItemTile`, `CreditMeter` — `@/components/shared/person-item`, `credit-meter`                                                                 | media/name/subtitle with action, `menu` and trail slots, optional `href` (the whole row links, row hover), `tone` surface/soft/ink; credits left/total with caller-supplied captions                                                                                          | Feature screens, shell, pickers                  | `Shared/Base/PersonItem`, `Shared/Base/CreditMeter`                                                           |
| Profile identity and next lesson         | `ProfileHero`, `NextLessonCard` — `@/components/shared/profile-hero`, `next-lesson-card`                                                                          | avatar, badges, name, meta, contact, action and `menu` slots, decorative glyph; lesson date/time/teacher with its own empty and loading states                                                                                                                                | Person profile screens                           | `Shared/Cards/*`                                                                                              |
| Aside blocks and contacts                | `InfoCard`, `ContactRow` — `@/components/shared/info-card`, `contact-row`                                                                                         | title with optional action; icon + value rows, `mono` for figures                                                                                                                                                                                                             | Feature detail asides                            | `Shared/Cards/*`                                                                                              |
| Profile notes                            | `NotesCard` — `@/components/shared/notes-card`                                                                                                                    | notes, updated label, labels, max length, read-only, `pending`; `onSave` resolves true to close the editor                                                                                                                                                                    | Person profiles                                  | `Shared/Cards/NotesCard`                                                                                      |
| Search and collection filters            | `SearchField`, `FilterPill` — `@/components/shared/search-field`, `filter-pill`                                                                                   | placeholder and shortcut; label, icon, `menu` or `pressed`, optional count                                                                                                                                                                                                    | Application shell, feature lists                 | `Shared/Collection/*`                                                                                         |
| Design glyphs and icon buttons           | `Glyph`/`GLYPHS`, `IconButton` — `@/components/shared/glyph`, `icon-button`                                                                                       | design glyph names mapped to Lucide; required `label`, size 44/38/36/32, tone, border, indicator                                                                                                                                                                              | Everything                                       | `Shared/Base/Icon`, `Shared/Base/IconButton`                                                                  |
| Collection segments                      | `Segmented` — `@/components/shared/segmented`                                                                                                                     | items with label/icon/count and an optional mark `tone` (selected segment fills with the tint and a dot), `surface`/`paper`; single choice                                                                                                                                    | Feature lists, auth locale switch                | `Shared/Collection/Segmented`                                                                                 |
| Form fields and choices                  | `TextField`, `fieldBoxClass`, `ChoiceCardGroup` — `@/components/shared/text-field`, `choice-card`                                                                 | label, required mark, aside, hint/error wired to the control; text/email/password/time/select/textarea, `suffix`                                                                                                                                                              | Every form                                       | `Shared/Form/TextField`, `Shared/Form/ChoiceCard`                                                             |
| Calendar date field                      | `DateField` — `@/components/shared/date-field`                                                                                                                    | "yyyy-MM-dd" value in the 52px field box, caller-formatted trigger, popover `Calendar` with a date-fns locale, `invalid`, `disabled`                                                                                                                                          | Lesson edit and makeup forms                     | `Shared/Form/DateField`                                                                                       |
| Full-page form frame                     | `FormPageLayout`, `FormSectionHeader`, `FormSectionCard`, `SectionNav`, `SectionChips`, `ActionBar`, `SectionSkeleton`, `ProgressMeter` — `@/components/shared/*` | `FormPageLayout` owns header, navigation (chips on phones), a block under it, notice, sections and bar; section ids, per-section status done/error, sticky save bar with note tone and caller-owned buttons; the progress caption sits on its own line under the bars         | Feature form pages                               | `Shared/Form/*`                                                                                               |
| Relationship linking                     | `LinkPicker`, `LinkPickerDialog` — `@/components/shared/link-picker`, `link-picker-dialog`                                                                        | linked set with ✕, controlled search, `results`/`selected`/`onToggle`, listbox keyboard; only the result list scrolls (`listClassName`), the field and the create command under it stay put; dialog: modal on desktop, sheet on phones, `confirmLabel`, `busy`, `returnFocus` | Feature forms and profiles                       | `Shared/Form/LinkPicker`, `Shared/Form/LinkPickerDialog`                                                      |
| Linked records on a profile              | `LinkedCard` — `@/components/shared/linked-card`                                                                                                                  | title with count, `addLabel` (omit for read-only), items with `href` and caller-owned `menu`, empty text and up to two actions, `size` md/sm                                                                                                                                  | Both sides of a relationship                     | `Shared/Cards/LinkedCard`                                                                                     |
| Destructive block of an edit form        | `DangerZone` — `@/components/shared/danger-zone`                                                                                                                  | title, what is lost, action label, `onAction`; the caller renders nothing for a viewer who cannot act                                                                                                                                                                         | Feature edit pages                               | `Shared/Form/DangerZone`                                                                                      |
| Banners, empty states and set-up         | `Notice`, `EmptyState`, `SetupChecklist` — `@/components/shared/*`                                                                                                | `Notice` tone danger/warning/info/success with action, `appearance` banner/callout (callout: white icon tile, tone-coloured title, adds indigo/neutral — the explanation inside decision dialogs); icon or media, dashed frame, dotted pattern                                | Feature screens                                  | `Shared/Feedback/*`, `Shared/Cards/*`                                                                         |
| Lifecycle status control                 | `StatusTrigger`, `StatusMenuContent`, `StatusSheet` — `@/components/shared/status-trigger`, `status-options`                                                      | tone active/hold/archived, size sm/md/lg; options with description, disabled, note                                                                                                                                                                                            | Feature status adapters                          | `Shared/Status/StatusSelect`                                                                                  |
| Adaptive decision dialog                 | `AdaptiveDialog` — `@/components/shared/adaptive-dialog`                                                                                                          | Dialog on desktop, Drawer on phones; icon tile, title, description, scrolling body, primary/secondary, `closeLabel` (desktop ✕), `size` md/lg                                                                                                                                 | Feature confirmations with fields                | `Shared/Dialogs/AdaptiveDialog`                                                                               |
| Lesson panel payment block               | `LessonPaymentCard` — `@/components/shared/lesson-payment-card`                                                                                                   | `tone` indigo/sky/success/warning, `art` rings/cards/check, overline `label`, `badge`, `figure` count/money or `headline`, credit `segments` used/current/charged/available with `detail` and `legend`, `text`, `chips`, `action`, `footer`                                   | Lesson panel                                     | `Shared/Cards/LessonPaymentCard`                                                                              |
| Lesson cancellation                      | `LessonCancellationCard` — `@/components/shared/lesson-cancellation-card`                                                                                         | `tone` danger/warning (the status tone), status `icon`, `title`, caller-quoted `reason`, `when`, `text`                                                                                                                                                                       | Lesson panel                                     | `Shared/Cards/LessonCancellationCard`                                                                         |
| Record history timeline                  | `LessonTimeline` — `@/components/shared/lesson-timeline`                                                                                                          | items with icon, `tone` danger/success/indigo/plain/system, title, time, meta; `visible` + "show all · N" / collapse labels, `fill` (only the list scrolls)                                                                                                                   | Lesson panel                                     | `Shared/Lists/LessonTimeline`                                                                                 |
| Group attendance summary                 | `AttendanceSummaryCard` — `@/components/shared/attendance-summary-card`                                                                                           | `tone` indigo (overline, title, white action, four mark tiles success/danger/info/warning with zero fading, text, note) or plain (bordered note with icon)                                                                                                                    | Lesson panel                                     | `Shared/Cards/AttendanceSummaryCard`                                                                          |
| Group member charge                      | `MemberChargeRow` — `@/components/shared/member-charge-row`                                                                                                       | media, name, coloured `note` (mark or package note, tones success/danger/info/warning/muted), charge `badge`, `stacked` (phones: badge under the name)                                                                                                                        | Lesson panel                                     | `Shared/Lists/MemberChargeRow`                                                                                |
| Consequence preview                      | `ImpactList` — `@/components/shared/impact-list`                                                                                                                  | rows of tinted icon tile (indigo/info/success/warning/danger/neutral), title with the number, optional text; dividers indented past the icon                                                                                                                                  | Status fix, move and other consequential dialogs | `Shared/Feedback/ImpactList`                                                                                  |
| Move at a glance                         | `MoveChange` — `@/components/shared/move-change`                                                                                                                  | `from`/`to` with date tile parts, label, time, hint; `stacked` (phones: down arrow)                                                                                                                                                                                           | Move dialog                                      | `Shared/Form/MoveChange`                                                                                      |
| Page crumb                               | `PageCrumbProvider`, `useSetPageCrumb`, `usePageCrumb` — `@/components/shared/page-crumb`                                                                         | a page names itself in the shell top bar                                                                                                                                                                                                                                      | Shell reads, features set                        | —                                                                                                             |

`LinkPicker` is the multi-select relationship picker; `EntityPicker` stays the
single-select combobox for form fields and filters. Do not merge them. Both
sides of a relationship use one `LinkedCard` with one `LinkPickerDialog` and
run on `useRelationshipLinks` (`@/hooks/use-relationship-links`): picker state,
unlink confirmation, rows for the set, and the save through `useLinkedSet`,
which keeps the last sent set authoritative until a newer record arrives and
holds the controls while the record refreshes. Unlinking confirms with the
neutral `ConfirmDialog`; the red one is reserved for deleting a record.
`Card tone="danger"` exists only for `DangerZone`.

A dialog opened from state rather than a trigger (`ConfirmDialog`,
`LinkPickerDialog`) returns focus to what opened it through `useReturnFocus`,
with a caller-supplied fallback when that element is gone. Input filters that
clean typed text (`@/lib/forms/input-filters`) wrap the registration's own
`onChange` with `filteredRegistration`; the `onChange` option of `register`
runs after react-hook-form has stored the value and cannot filter it.

The generic status contract deliberately has no validation DTO import. Each
domain adapter maps its lifecycle DTO and localized copy locally. `StatBlock` is
the one metric block.

Shared components own no copy. Every label, caption and empty-state string is
supplied by the feature that knows the domain and the locale.

Since 2026-09-24 the web app holds only the rebuilt screens (sign-in and
registration, the application shell, Students, Parents, Groups). The screens
and components of the former design — dashboard, calendar, lesson patterns and
dialogs, packages and payments, teachers, settings, enrollment dialog, and the
value controls and metric/collection helpers only they used — were removed;
they return as new screens from the owner's mockups, built on this registry.

#### Reference compositions

- Collection: compose `PageHeader`, error/loading feedback, desktop table,
  feature-owned mobile cards, `EmptyState`, and pagination through
  `CollectionFrame`. The frame never owns queries,
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

The theme is the approved "Studio - Indigo & Sky" token set. Alongside the
shadcn variables it defines the product semantics the design depends on:
`brand` and `brand-soft`, `surface-hover`, the `tint-*` families with their
foreground pairs, `danger-mark`, the `status-*` lifecycle colours, the `ink-*`
surface family and the `stat-*` chart pair, plus the semantic radii
`pill`, `logo`, `item`, `tile`, `row`, `block`, `card` and `hero`.

Both themes are complete. `:root` holds the light palette and `.dark` the
approved dark palette; every token, including the tints and the ink family, is
redefined by the dark theme. A tint keeps its hue and inverts its lightness, so
a light tint never shines out of a dark page. `.surface-light` shares the
`:root` block and pins the whole light palette for illustrations that must stay
light in both themes (the auth promo panel). Shadows are mixed from
`--shadow-ink`, and the dark theme raises every alpha by `--shadow-boost`.

Some light values do two jobs that stop agreeing on a dark page, so they have
their own tokens. In light each equals the value it replaced:

- `tint-foreground` — body text on any tint (`Card` tones `info`, `warning`,
  `indigo`; `StatBlock` tint and accent; `EntityPreview`; `SetupChecklist`).
  Never write `text-ink` on a tint: in dark `ink` is a deep surface colour.
- `tint-indigo-meta` — the secondary line on the indigo hero.
- `tile-indigo` and its foreground — small indigo tiles: icon tiles, initials,
  the mobile tab pill. **Rule: a surface under ~64px is a tile and uses
  `tile-indigo`; a larger surface (the profile hero, `Card tone="indigo"`, the
  avatar preview) uses `tint-indigo`.** In dark a tile at the hero's value
  vanishes.
- `chip-on-tint` and its foreground — the `on-tint` Badge.
- `stat-track-on-tint` — chart tracks inside a tinted `StatBlock`.
- `feature-*` (`feature`, `-foreground`, `-heading`, `-muted`, `-soft`,
  `-line`) — the one highlight card on a page, `Card tone="feature"`
  (`NextLessonCard`, its `PersonItem tone="ink"` row and `on-ink` chip). It is
  the ink card in light and the saturated indigo in dark, while `ink-*` stays a
  quiet deep surface (`StatBlock tone="ink"`, toasts).
- `raised` and `raised-line` — the `white` Button: white paper in light, a
  hairlined chip in dark.
- `nav-selected-*` — the current `SectionNav` item: a white row in light, a
  painted `tile-indigo` row with a `brand-soft` icon tile in dark.
- `scrim` — modal overlays.
- `scrollbar-thin` and `no-scrollbar` — the two scroll utilities: a thin
  token-coloured bar for an inner scroll (`LessonList`, picker results) and a
  hidden bar for horizontal chip rows. Do not style scrollbars per component.
- `shadow-ink` and `shadow-boost` — the colour and dark alpha step of every
  elevation shadow.

Feature and screen code never adds `dark:` colour utilities: when a surface
needs a different value in dark, the fix is a token pair in `globals.css`.
The only `dark:` utilities left are upstream shadcn opacity tweaks in
`components/ui`.

Badge accents are therefore no longer capped at five. The approved set is
`neutral`, `primary`/`indigo`, `info`, `success`, `warning`, `danger`,
`brand`, `surface`, `on-ink` and `on-tint`. Domain code still speaks the
`StatusTone` vocabulary and maps to a Badge variant through
`badgeVariantForTone`; it must not reach for a tint token directly. Narrow token corrections are permitted when automated accessibility
tests prove that an upstream preset value misses the required contrast; the
current baseline corrects the light destructive pair for this reason. Contrast
for every dark pair is measured against WCAG 2.1 AA; re-measure before
changing a value. Workspace colour customization is not a pilot capability. Adding it
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

One component, one entry. A story file documents one component with a
`Playground` story whose `args`/`argTypes` expose every variant as a control;
extra named stories exist only for interaction tests or states that controls
cannot reach. Locale, theme and viewport (including the handoff's 1440 and
390 frames) come from the toolbar, never from duplicated stories. Screen
stories under `*/Screens/*` render the real feature against the in-memory
backend in `src/stories/story-backend.tsx`; sample data lives only there.
`scripts/capture-studio-screens.mjs` captures them for comparison with the
design screens.

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
