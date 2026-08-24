# Tutorio Current State

Last verified: 2026-08-04.

This is the first document to read before planning or implementing work. It is
the operational checkpoint; `mvp-plan.md` remains the product and architecture
source of truth.

## Repository checkpoint

- Active branch: `refactor/students-design`.
- At the start of this audit the branch was clean and pushed to
  `origin/refactor/students-design`; the current uncommitted changes are the
  documentation updates produced by this audit.
- It is three commits ahead of `develop`; `develop` has no commits that are not
  already in the active branch.
- The branch is a broad refactor: 182 files differ from `develop`, with changes
  across web, API, validation, domain logic, migrations, and generated API
  types. Treat it as a release candidate that needs acceptance, not as a place
  to begin another feature stage.
- Verification on 2026-08-04: root `lint`, `typecheck`, `test`, and `build` all
  pass. Unit totals observed: domain 88, validation 43, API 98, web 106.

## Implemented product surface

- Authentication, workspaces, solo/school mode, roles, and i18n.
- Students, parents, groups, teachers, and enrollments.
- Lesson scheduling, recurring patterns, conflict checks, rescheduling, and the
  lesson status state machine.
- Calendar and pattern management.
- Individual and group packages, participant shares, payments, credit ledger,
  package history, and package-driven recurring scheduling.
- Base workspace settings, audit log, design lab, and shared UI patterns.

This corresponds to Stages 0-4 in the product plan. The active branch also
contains a large visual and interaction refactor of these surfaces.

## Not implemented yet

- Operational action centre, full dashboard, and analytics.
- Telegram reminders, teacher digest, and homework delivery.
- Progress entries, tests, lesson journal, attachments, and attendance.
- Public student page and student/parent portal.
- Branded receipts and the complete settings surface.
- CSV import, SpeakWise pilot tooling, GDPR export/deletion.
- Leads CRM.

## Current product risks

1. **The active branch is too broad for more feature work.** It needs visual
   acceptance and a merge decision first.
2. **Visual QA is incomplete.** `design-qa.md` records a blocked group-detail
   comparison because no implementation screenshot was captured.
3. **Roadmap labels drifted.** Leads are described as both Stage 4.5 and Stage
   9.5 in different files. The stage index now treats the file as a historical
   identifier and the work as post-pilot.
## Active milestone: Stage 4.1 acceptance and stabilization

No new product module starts until this checkpoint is complete.

- Capture current desktop and mobile renders for students, groups, calendar,
  lesson creation, packages, package detail, and settings.
- Run the four core acceptance scenarios against realistic seed data:
  student/group setup; recurring schedule; package/payment; lesson
  completion/cancellation and ledger effect.
- Resolve P0/P1 visual and workflow findings.
- Confirm domain rules in `mvp-plan.md` still match the implementation.
- Merge the branch into `develop` through a reviewed PR.
- Update this file with the merged commit and the next active stage.

## Product direction

Tutorio is an operations cockpit for private tutors and small schools. Its
distinctive promise is not merely storing students and lessons; it connects the
full chain:

`schedule -> lesson outcome -> credit/money effect -> progress -> communication`

The three differentiating surfaces to protect in future work are:

1. An action centre that tells the tutor what needs attention today.
2. Explainable finances where every balance can be traced to a human-readable
   event history.
3. A unified student story combining schedule, money, progress, and
   communication without making the user jump between disconnected modules.
