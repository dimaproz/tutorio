# Tutorio Pilot-First Roadmap

Last verified: 2026-09-10.

This roadmap replaces feature-by-feature expansion as the active delivery
strategy. Complete phases in order. A later phase may be designed, but it must
not be implemented while an earlier release gate is red.

## Now — Phase 0: Decisions become executable rules

Outcome: the team can change code without guessing what “correct” means.

- Accept ADRs 0001–0004 as the target product contract.
- Convert the cancellation/billing matrix, deletion policy, package ownership,
  and owner-only permissions into domain and API tests.
- Build representative seed scenarios: individual fixed package, group package
  with shares, partial payment, charged cancellation, uncharged cancellation,
  paused enrollment, and archived group.
- Establish an isolated local/CI end-to-end command and document that root unit
  tests do not include it.

**Gate:** tests fail for each confirmed implementation defect and pass for
already-correct invariants. No unresolved product semantics remain in P0 flows.

## Next — Phase 1: Correctness stabilization

Outcome: existing data cannot be silently mischarged, orphaned, or destroyed.

- Make group archive/restore reversible and history-preserving.
- Enforce payment-to-package participant ownership and currency consistency.
- Persist the charged package on lessons and compensate only that package.
- Make charged lesson/package deletion safe through blocking or explicit
  compensating operations.
- Correct cancel/restore repetition, share calculations, enrollment pause, series
  materialization, recurrence conflict checks, and effective status filtering.
- Remove or correctly implement the misleading automatic-replacement action.
- Fix boolean query parsing at the runtime API boundary.

Lifecycle closure is complete before Exact Credit Compensation: archive/restore
now has a migration-safe student timestamp, no archived-PATCH bypass, and a
history-preserving group roster boundary. Legacy destructive group deletes are
detected and refused for manual repair rather than misrepresented as safe
archive records. Work Packet 3 is complete at `61fbfbd`, including immutable
financial snapshots, fixed-count occurrence-time eligibility, exact legacy
compensation, net consumption, package archive safety, and legacy-conflict
detection. Work Packet 4 — Recurrence and Pause Correctness is complete:
token-correlated suspension/restoration, active group-roster eligibility,
serialized conflict-safe materialization, future-rule edit boundaries, and
stored-status filtering are verified at implementation `76463d9`. Work Packet 5
— Pilot Authorization is complete at implementation `e362675`: the explicit
59-route permission matrix leaves only five public and two authenticated
self/session handlers; all 52 business routes require `OWNER`. Legacy `TEACHER`
E2E denial and zero-side-effect coverage passes against isolated PostgreSQL 17.

**Gate:** all P0/P1 core integrity scenarios pass at domain, service, and
end-to-end levels; migrations are reversible or have an approved rollback plan.

## Then — Phase 2: Pilot-critical workflow simplification

Outcome: a tutor can complete core tasks without understanding the data model.

- Complete the bounded frontend foundation in `frontend-plan.md`: official
  shadcn baseline, Storybook, authentication shell, application shell, and
  reusable product-component boundary.
- Use the Students list, detail, and quick-create journey as the first complete
  feature migration and reference implementation.
- Migrate every existing pilot surface one domain at a time before Work Packet
  7: Parents, Teachers, Groups and Enrollments, Scheduling, package read
  surfaces, then Dashboard and Settings.
- Preserve proven API, permission, localization, lifecycle, and financial
  behavior while allowing each page layout and composition to be replaced.
- Split parent linking/creation from the mandatory student submission path and
  expose saved-profile next actions.
- Replace package creation with a short sale flow and post-create next steps.
- Move recurrence into a dedicated scheduling step and payment into a dedicated
  record-payment action.
- Make package terminology, entitlement, usage, payment, and cancellation
  consequences self-explanatory.
- Add form interaction tests, loading/error/empty/success states, mobile checks,
  and locale parity.
- Split oversized feature components to the documented web boundaries while
  changing each flow; never merge the route migrations into a big-bang rewrite.

Approved implementation order:

1. Work Packet 6 — Student Experience and Quick Create.
2. Work Packet 6.1 — Parents (closed 2026-09-23).
3. Work Packet 6.2 — Teachers.
4. Work Packet 6.3 — Groups and Enrollments (groups implemented 2026-09-23,
   ahead of 6.2 at the product owner's request; see
   [`product/groups.md`](./product/groups.md)).
5. Work Packet 6.4 — Lessons, schedules and charging: contract accepted
   2026-09-23 ([`product/scheduling.md`](./product/scheduling.md), ADR 0007);
   backend phases first, screens from the owner's mockups.
6. Work Packet 6.5 — Package list, detail, ledger, and payment-history surfaces;
   the package sale flow remains reserved for Work Packet 7.
7. Work Packet 6.6 — Dashboard and Settings.
8. Work Packet 7 — Lesson Pack Sale.

**Gate:** every existing pilot route has passed its migration gate, and a
first-time tutor completes student setup and package sale in an observed
usability session without developer explanation or data correction.

## Then — Phase 3: Pilot operations

Outcome: representative customer data can enter, run, and leave safely.

- Minimal student CSV import with preview, validation, and row-level errors.
- Package/payment import only for the actual pilot dataset after mappings are
  confirmed; imported balances enter through explicit adjustment history.
- Database readiness check, error monitoring, backup schedule, restore drill,
  workspace export, and controlled deletion/anonymization runbook.
- Pilot dashboard limited to today’s lessons and actionable exceptions.

**Gate:** dry-run migration plus one full operational week in staging completes
without direct database fixes.

## Then — Phase 4: Controlled pilot

Outcome: one owner-tutor or small school completes a real billing cycle.

- Migrate representative data and train the owner on the four core journeys.
- Capture every support intervention as a defect or documentation gap.
- Review adoption, task completion, financial reconciliation, and recovery
  incidents weekly.
- Graduate only after one full payment cycle reconciles without manual database
  changes.

## After evidence, not before

Prioritize the next module from pilot evidence:

1. Telegram reminders if missed communication is the top repeated pain.
2. Progress tracking if tutors consistently need a learning record.
3. Analytics if operational data is trusted and decisions require aggregation.
4. Public/portal access if students or parents repeatedly request self-service.
5. Leads CRM only after the operational core is retained by pilot users.

## Design investment rule

Use an 80/20 allocation until pilot graduation:

- 80% correctness, tests, migration, observability, and workflow completion.
- 20% design work limited to pilot-critical comprehension, accessibility, and
  responsive quality.

For Work Packets 6–6.6, this rule applies inside each route migration: most
effort must preserve behavior, complete states, reduce workflow complexity, and
add tests; visual work remains the standard shadcn composition needed to make
that route coherent. Decorative branding, custom motion, and speculative polish
do not enter these packets.

ADR 0005 replaces the former visual direction with a bounded official shadcn
foundation because the mixed TailAdmin layer made pilot-critical workflows
harder to change safely. This is presentation standardization, not an open-ended
redesign. Distinctive branding, custom motion, and visual polish of deferred
modules remain paused. Existing page layouts are behavior references only; each
migrated page receives an architect-approved screen brief before implementation.
