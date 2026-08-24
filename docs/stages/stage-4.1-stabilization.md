# Stage 4.1 — Core Acceptance and UX Stabilization

> **Outcome:** the current Students-to-Money product core is visually verified,
> understandable, and safe to pilot before another module is added.
>
> **Pillar:** Foundation · **Status:** Active · **Depends on:** Stages 0-4.

## Goals

- Complete acceptance of `refactor/students-design` and merge it to `develop`.
- Verify desktop and mobile renders for every core route against the local
  design contract.
- Reduce high-frequency workflow friction without expanding feature scope.
- Seed realistic solo-tutor and small-school workspaces.
- Run the core business scenarios end to end and confirm their ledger effects.
- Freeze current domain decisions and update the operational checkpoint.

## Non-goals

- No leads, analytics, Telegram, progress, portal, or new integration work.
- No new abstraction unless it removes repeated code from at least two current
  callers.

## Acceptance flows

1. Create a student, link a parent, and enrol the student individually or in a
   group.
2. Create a recurring pattern and verify timezone-safe materialisation.
3. Create an individual and a group package, record partial/full payments, and
   inspect participant shares.
4. Complete, reschedule, cancel charged, and cancel uncharged lessons; verify
   the human-readable credit and money history.

## UX acceptance

- The component and theme contract in `docs/design-system.md` is accepted.
- Product screens compose installed shadcn primitives and approved Tutorio
  components; duplicated primitives and one-off visual patterns are removed.
- Semantic theme tokens are consolidated so a colour, radius, typography,
  shadow, or dark-mode change does not require editing feature screens.
- `/design` documents approved product components, their usage, and meaningful
  states. One list, one detail view, and one form dialog are reference
  compositions for all remaining domains.
- Expanded navigation exposes labels; active location is obvious.
- Lists have one clear primary action and place secondary row actions in a menu.
- Long forms use sections, progressive disclosure, sensible defaults, and a
  visible summary of financial/scheduling consequences.
- Loading, empty, error, success, and destructive states are represented.
- Desktop/mobile, light/dark, and Ukrainian/English are checked.
- Drag-based interactions have a non-drag alternative.

## Verification

- Root `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.
- Browser screenshots are captured for the accepted routes and stored with the
  design QA report.
- The four acceptance flows pass with realistic seed data.
- A reviewed PR merges the branch into `develop`.
- `docs/current-state.md` records the merged commit and next active stage.
