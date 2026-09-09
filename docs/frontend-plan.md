# Frontend Foundation Plan

Last verified: 2026-09-09.

This plan defines the bounded frontend track that runs before Work Packet 6.
It replaces the former TailAdmin-led visual work with a maintainable official
shadcn baseline. The track must preserve working product behavior while making
future page work consistent, testable, and inexpensive to restyle.

## Target outcome

Before Work Packet 6 starts:

- the official shadcn `radix-nova` preset is the only primitive visual system;
- TailAdmin-specific runtime styling and documentation are removed;
- Storybook is the executable catalog for Tutorio-owned components;
- login and authenticated application shell use explicitly selected official
  shadcn blocks as their structural references;
- agents are prevented from recreating existing primitives and product patterns;
- every existing route remains functional, even if its feature content has not
  yet received a page-level redesign.

This is not a pixel-polish project and not a migration to Base UI. It creates a
stable presentation boundary before the pilot-critical Students and Packages
flows are simplified.

## Design authority

Current Tutorio screens are behavior references only. They preserve API calls,
permissions, localization, and edge cases, but their layouts may be replaced.

For every migrated page, the architect or work-packet author must provide a
screen brief containing:

1. primary user job and primary action;
2. information hierarchy and progressive disclosure;
3. named official shadcn block reference;
4. installed primitives and existing Tutorio components to reuse;
5. desktop/mobile composition;
6. complete runtime states;
7. interaction, accessibility, and localization acceptance criteria.

The implementing agent may suggest a better composition within that contract.
It may not introduce a parallel primitive or use the previous page as an
unquestioned template.

## Frontend Packet F0 — Direction Reset

Status: implemented on 2026-09-09; verification belongs to this change.

Scope:

- accept ADR 0005;
- retire and remove the production `/design` route and its isolated demo code;
- remove TailAdmin as a design authority from active engineering instructions;
- establish official shadcn blocks and the screen-brief requirement;
- record the frontend packet sequence before Work Packet 6.

Gate:

- no production import depends on the removed design feature;
- repository docs identify one frontend direction;
- root lint, typecheck, test, and build remain green.

## Frontend Packet F1 — Shadcn Baseline

Status: next.

Purpose: return the runtime visual foundation to a predictable official
`radix-nova` baseline without changing product workflows.

Scope:

1. Inventory every installed file in `components/ui` against the official
   registry with `shadcn add --dry-run` and per-file `--diff`.
2. Restore stock variants, sizes, spacing, and motion one primitive at a time.
   Preserve only verified accessibility, localization, or application fixes and
   document every intentional deviation.
3. Replace the duplicated TailAdmin/workspace theme declarations in
   `globals.css` with the official neutral shadcn tokens.
4. Keep only required Tutorio semantic additions such as `success` and
   `warning`; isolate user-provided workspace colors from core primitive tokens.
5. Switch the root interface font from the TailAdmin-derived Onest choice to
   the preset's Geist baseline.
6. Remove unused UI dependencies after import and build verification. Keep
   Radix as the configured primitive base.
7. Add automated checks that reject raw product colors, direct `radix-ui`
   imports outside `components/ui`, and obvious duplicate primitive files.

Non-goals:

- no page redesign;
- no form workflow changes;
- no Base UI migration;
- no new animation library.

Acceptance:

- official theme controls light and dark mode;
- existing routes remain usable;
- every intentional primitive deviation is listed in documentation;
- web lint, typecheck, test, and build pass.

## Frontend Packet F2 — Storybook Foundation

Purpose: make owned component behavior discoverable and testable without a
production component-lab route.

Scope:

1. Install the current Storybook integration for Next.js with Vite.
2. Configure Tailwind globals, theme switching, `next-intl`, routing mocks, and
   the minimum providers required by owned components.
3. Enable docs, interaction tests through the Vitest integration, and automated
   accessibility checks.
4. Add stories for the locally owned or critical baseline components: Button,
   Input, Select/Combobox, Dialog, Sheet, Card, Badge, Table, Empty, Skeleton,
   shared form shell, collection toolbar, and entity picker.
5. Cover default, disabled, loading, validation, open/closed, destructive,
   long-copy, mobile-width, light, and dark states where applicable.
6. Add `storybook` and `build-storybook` scripts and make the static build a CI
   gate for frontend work.

Do not reproduce the complete public shadcn documentation. Stories document
Tutorio-owned contracts and the states that agents must reuse.

Acceptance:

- Storybook starts without the application backend;
- required providers and both locales render deterministically;
- interaction and accessibility checks run in automation;
- Storybook static build is green.

## Frontend Packet F3 — Authentication Shell

Purpose: replace the current auth presentation with a direct shadcn composition
while preserving authentication behavior.

Reference: official shadcn `login-03` block for the centered muted-background
layout. Use its matching registration composition where applicable.

Primary job: sign in or create an account without distraction.

Composition:

- `Card`, `CardHeader`, `CardContent`, and `CardFooter`;
- `FieldGroup`, `Field`, `FieldLabel`, `Input`, and existing password control;
- `Alert` for request failures;
- `Button` plus `Spinner` for pending submission;
- localized product identity and links.

Scope:

- adapt the block to existing login/register routes and API contracts;
- preserve redirect, refresh, error mapping, keyboard submission, and password
  visibility behavior;
- add stories and interaction tests for default, invalid, pending, API error,
  mobile, dark, Ukrainian, and English states.

No decorative image asset, social authentication, or new auth capability is
introduced by this packet.

## Frontend Packet F4 — Authenticated Application Shell

Purpose: give every signed-in route one standard responsive CRM frame.

Reference: the shell structure from official shadcn `dashboard-01` using
`SidebarProvider`, `AppSidebar`, `SidebarInset`, and a sticky `SiteHeader`.
Only the shell is adapted; demo charts, drag-and-drop tables, and unrelated
dependencies are not imported.

Primary job: move between daily operations while preserving context.

Composition:

- official shadcn Sidebar primitives;
- `DropdownMenu` for workspace/user actions;
- `Breadcrumb` where hierarchy is real;
- `Separator`, `Tooltip`, `Avatar`, and `Button`;
- existing locale and theme controls through standard slots.

Scope:

- replace the current custom shell composition;
- map Tutorio navigation and active-route behavior;
- preserve collapse preference, mobile Sheet behavior, sign-out, locale, theme,
  and permission visibility;
- define one standard content width, page padding, heading region, and mobile
  header behavior through shared layout components;
- add shell stories and interaction/accessibility coverage.

Acceptance:

- all authenticated routes render inside the same shell;
- desktop collapsed/expanded and mobile navigation work with keyboard and touch;
- no feature page owns sidebar or header styling.

## Frontend Packet F5 — Product Composition Boundary

Purpose: make the component hierarchy enforceable before the first redesigned
entity flow.

Scope:

1. Keep `components/app` only for the application shell; move domain-independent
   reusable product compositions to `components/shared`.
2. Inventory duplicate cards, dialogs, list toolbars, form actions, empty states,
   status badges, and entity pickers. Select one owner for each semantic pattern.
3. Add a documented component registry with import examples and stable props.
4. Add or update stories and behavior tests for each approved shared component.
5. Establish reference compositions for one list frame, one detail frame, and
   one form overlay without redesigning every entity page.
6. Enforce the dependency flow `app -> features/shared -> ui/lib`.

Gate to Work Packet 6:

- no competing shared/app ownership remains;
- the reference list, detail, and form compositions are documented and tested;
- an agent can find the correct component without inspecting unrelated pages;
- all existing routes remain green.

## Work Packet 6 handoff — Student Quick Create

Work Packet 6 is the first feature migration on the new foundation. Before code
starts, its prompt must include an architect-approved Students screen brief.
The brief should treat the current screen as behavior evidence and may choose a
new layout based on the student's primary jobs.

Expected reference composition:

- shared collection frame and toolbar;
- one owning `StudentCard`/row representation with explicit density variants;
- compact quick-create dialog based on `FieldGroup` and the shared form shell;
- post-save next actions instead of embedding parent, package, payment, and
  scheduling configuration in the mandatory create form;
- complete loading, empty, error, archived, permission, mobile, and locale states.

Only after Work Packet 6 establishes the reference feature pattern should the
remaining domains be migrated one by one. Do not perform a big-bang rewrite of
all feature pages.

## Verification for every frontend packet

- `pnpm --filter @tutorio/web lint`
- `pnpm --filter @tutorio/web typecheck`
- `pnpm --filter @tutorio/web test`
- `pnpm --filter @tutorio/web build`
- `pnpm --filter @tutorio/web build-storybook` after F2
- desktop/mobile, light/dark, Ukrainian/English evidence for visual changes

Root checks remain mandatory before commit. API E2E is required only when a
frontend packet changes an API contract or pilot-critical integrated behavior.
