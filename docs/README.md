# Tutorio Documentation Map

Last verified: 2026-09-08.

This directory is the operating manual for product and engineering work. Read
documents in the order below; a document lower in the list must not silently
override one above it.

## Source-of-truth order

1. [`../AGENTS.md`](../AGENTS.md) and package-level `AGENTS.md` files define
   repository rules and engineering constraints.
2. [`decisions/`](./decisions/README.md) records accepted architectural and
   product decisions. Supersede an ADR with another ADR; do not rewrite history.
3. [`current-state.md`](./current-state.md) is the verified operational
   checkpoint: what exists, what is risky, and what is active now.
4. [`mvp-plan.md`](./mvp-plan.md) defines the pilot product boundary and core
   invariants.
5. [`architecture.md`](./architecture.md) defines system and module boundaries;
   [`glossary.md`](./glossary.md) defines shared product language.
6. [`roadmap.md`](./roadmap.md) defines execution order and release gates.
   [`next-work.md`](./next-work.md) is the short-lived active implementation queue.
   [`api-permission-matrix.md`](./api-permission-matrix.md) is the complete
   pilot API access policy.
7. [`domain/`](./domain/README.md) documents entities, relationships, lifecycle,
   deletion, permissions, and known implementation gaps.
8. [`product/`](./product/README.md) documents user journeys and target UX.
9. [`stages/`](./stages/README.md) contains implementation briefs. Stage files
   elaborate the roadmap; they do not expand the MVP on their own.
10. [`quality/pilot-acceptance.md`](./quality/pilot-acceptance.md),
    [`design-system.md`](./design-system.md), and [`deploy.md`](./deploy.md)
    define delivery, UI, and operational gates.

## Documentation rules

- Repository documentation is English-only. Product locale files are the only
  exception.
- Every stateful document carries a `Last verified` date. Update it only after
  checking the implementation or running the stated verification.
- Describe current behavior separately from target behavior. A documented
  target is not evidence that the code implements it.
- Record durable decisions as ADRs; record work as roadmap or stage items; do
  not hide decisions in task lists.
- Every domain change updates the affected aggregate document in the same PR.
- Every lifecycle change specifies permissions, side effects, audit behavior,
  and what happens to related financial and scheduling records.
- Every new user workflow defines happy path, validation, empty/error states,
  destructive behavior, accessibility, and acceptance evidence.
- Link to code rather than copying implementation details that will drift.

## Change checklist

| Change type                                | Required documentation                                             |
| ------------------------------------------ | ------------------------------------------------------------------ |
| Entity, relation, status, or deletion rule | Relevant file in `domain/` and an ADR when the rule is durable     |
| User journey or form change                | Relevant file in `product/` and its stage acceptance criteria      |
| Scope or priority change                   | `mvp-plan.md`, `roadmap.md`, and `current-state.md`                |
| Shared visual pattern                      | `design-system.md` and `/design`                                   |
| Deployment or environment change           | `deploy.md`                                                        |
| Release-ready claim                        | `current-state.md` and `quality/pilot-acceptance.md` with evidence |

## Documentation debt policy

Documentation drift is a release defect. If code and documentation disagree,
the current implementation must be investigated before either is treated as
correct. Known disagreements are listed explicitly in `current-state.md` and
the relevant domain document.
