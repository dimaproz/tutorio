# ADR 0005: Official Shadcn Frontend Foundation

- Status: Accepted
- Date: 2026-09-09
- Supersedes: the TailAdmin design-source decision in ADR 0001

## Context

Tutorio's data and workflow surface is broad enough for a pilot, but recent UI
work mixed an external TailAdmin visual reference, duplicated theme tokens,
locally changed shadcn primitives, product compositions, and a production
`/design` component lab. The result is difficult to evaluate and expensive to
change consistently.

The current product pages also became an accidental visual reference even when
their information hierarchy and workflow were not validated. Agents could copy
an existing layout or create a new local pattern without a clear screen contract.

The product needs a plain, coherent, working baseline before investing in a
distinctive visual identity. It also needs executable component documentation
so humans and agents can reuse the same states and compositions.

## Decision

Adopt the official shadcn preset as the sole pilot primitive and theme baseline.
The current baseline is `radix-luma`, generated from preset `b1Gwk6B7o`: Stone
base, Blue theme, Amber chart palette, default radius, default/solid menu, and
subtle menu accent. Retain the existing Geist and Geist Mono typography instead
of the preset's Inter selection.

- Keep Radix as the configured headless base during pilot stabilization.
- Use official shadcn components and explicitly named official shadcn blocks as
  implementation references.
- Use `login-03` as the authentication-layout reference.
- Use the shell structure from `dashboard-01` as the authenticated application
  layout reference without importing unrelated demo features or dependencies.
- Treat existing Tutorio screens as behavior and data references, not visual
  contracts.
- Require an architect-approved screen brief before every page migration. The
  brief owns the user job, information hierarchy, component composition,
  responsive behavior, and required states.
- Remove the production `/design` route. Adopt Storybook as the development-only
  catalog and test surface for components and hard-to-reach states.
- Preserve a strict hierarchy: shadcn primitives, shared Tutorio compositions,
  application shell, feature-owned components, then routes/screens.
- Forbid direct primitive-library imports outside `components/ui`, duplicate
  primitives, raw product colors, and page-owned theme decisions.
- Remove workspace-level colour customization from pilot settings, session/API
  contracts, and persistence. Light/dark mode remains the only runtime theme
  choice; teacher colours remain scheduling data rather than interface tokens.
- Permit new shared components only for a stable semantic purpose demonstrated
  by at least two callers. Feature-owned components such as `GroupCard` remain
  single implementations with explicit variants where needed.
- Limit pilot motion to shadcn's short state-driven transitions and
  `tw-animate-css`. A broader animation system requires a later decision.

Run the bounded frontend foundation packets in `docs/frontend-plan.md` before
Work Packet 6. Do not combine the entire feature-page migration into one change.

## Consequences

- The pilot will temporarily look like a standard shadcn application. This is
  intentional and preferable to an inconsistent custom theme.
- Login and application shell can change independently from entity workflows.
- Storybook replaces an application route and adds a build/test responsibility.
- Future design changes should concentrate in semantic tokens, primitives,
  shared compositions, and Storybook baselines rather than feature pages.
- Existing feature pages remain functional during migration but are redesigned
  only when their work packet supplies a validated screen brief.
- A new visual identity, animation library, or Base UI migration is deferred
  until pilot evidence justifies it.
- Deploying the F1 migration discards the former workspace colour values. They
  are non-operational presentation preferences and are not migrated elsewhere.

## Amendment — 2026-09-10

The initial F1 implementation used `radix-nova`. After F3 validation, the
official baseline was migrated in place to `radix-luma` using preset
`b1Gwk6B7o`. This changes central theme tokens and official primitive styling,
not product workflows or component boundaries. Existing Geist typography and
documented accessibility and modal-portal safeguards remain intentional local
exceptions.
