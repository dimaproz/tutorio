# ADR 0001: Pilot-First Delivery

- Status: Accepted
- Date: 2026-08-24

## Context

Tutorio already has a broad core and a strong visual direction, but critical
lifecycle, accounting, authorization, and end-to-end verification gaps remain.
Recent work invested heavily in custom components and broad visual refactoring.
Continuing that direction would increase surface area without proving that a
real tutor can trust the core operating loop.

## Decision

Ship a narrow owner-operated pilot before building another major module or
performing another design-wide refactor.

- Stabilize data integrity and financial rules first.
- Simplify only the workflows required by the pilot.
- Use the existing TailAdmin-aligned shadcn design system.
- Allocate roughly 80% of near-term capacity to correctness, tests, operations,
  and pilot migration; allocate 20% to task comprehension, accessibility, and
  responsive UX.
- Defer analytics, progress, portals, Telegram, receipts, leads, and SaaS billing
  until pilot evidence selects the next problem.

## Consequences

- “Looks polished” is not a release criterion unless visual quality affects task
  completion, trust, accessibility, or responsive use.
- New reusable primitives require a demonstrated pilot need and the existing
  design-system workflow.
- Product work is ordered by [`../roadmap.md`](../roadmap.md), not by the oldest
  numbered unimplemented feature stage.
- The team will intentionally leave some secondary screens visually imperfect
  while eliminating data and workflow risk.
