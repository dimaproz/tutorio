# Screen Delivery Plan

Last verified: 2026-09-25 (S01–S05 done; S08's member prices built ahead).

The backend of Work Packet 6.4 is complete (phases 1–7, see
[`next-work.md`](../next-work.md)); the web app holds only the rebuilt
Students, Parents and Groups screens after the frontend reset. The remaining
screens and dialogs are built one step at a time from the owner's mockups.

Each step below is a brief in the sense of [`AGENTS.md`](../../AGENTS.md): it
names the user job, the entry points, the screens and dialogs, the data the
API already provides, the rules to respect, the components to reuse, and what
the mockups must show. A step starts only when its mockups arrive; the brief
is then completed with the mockup references and any decision the mockups
make, and becomes the acceptance list for that step.

## Process for every step

1. **Mockups in.** The owner hands over the step's mockups (desktop 1440 and
   phone 390, light and dark where they differ) and answers the step's open
   questions.
2. **Brief check.** The mockups are checked against the brief: missing
   states, data the API does not provide, and conflicts with the contract
   ([`product/scheduling.md`](../product/scheduling.md)) are raised before
   any code is written. The brief records the answers.
3. **Build.** Compose installed shadcn primitives and the approved product
   components ([`design-system.md`](../design-system.md)); a new shared
   pattern gets its Storybook story and a registry row in the same change.
   Screens get `*/Screens/*` stories against the story backend.
4. **Verify.** Web lint, typecheck, unit and interaction tests, build,
   Storybook tests; the screen checked in the browser at desktop and phone
   width, in both locales and both themes.
5. **Close.** The brief's status becomes "Done" with the commit range, and
   [`next-work.md`](../next-work.md) and [`current-state.md`](../current-state.md)
   are updated.

## Steps

| Step                                      | What it delivers                                                                               | Work packet | Status              |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------- | ------------------- |
| [S01](./s01-lesson-panel.md)              | Lesson side panel and every action on one lesson (status, edit, move, makeup, attendance)      | 6.4         | Done                |
| [S02](./s02-lesson-create.md)             | Lesson create form: one-off, several dates, past lessons, "Repeat"                             | 6.4         | Done                |
| [S03](./s03-calendar.md)                  | Calendar: week, day and month, filters, create by click, move by drag                          | 6.4         | Done                |
| [S04](./s04-lessons-list.md)              | Lessons list with quick filters, and the bulk cancel dialog                                    | 6.4         | Done                |
| [S05](./s05-schedules.md)                 | Schedules page, schedule form, change, stop and horizon dialogs                                | 6.4         | Done                |
| [S06](./s06-student-billing-and-pause.md) | Student profile: directions and billing, schedules, pause, recording a payment                 | 6.4         | Waiting for mockups |
| [S07](./s07-packages.md)                  | Package sale form and package operations: detail, extend, transfer, refund, pay                | 6.5, 7      | Waiting for mockups |
| [S08](./s08-group-page-operations.md)     | Group page: editable schedule, attendance, sell to members, members' billing                   | 6.4         | Waiting for mockups |
| [S09](./s09-teachers.md)                  | Teachers: collection, profile, form, status                                                    | 6.2         | Waiting for mockups |
| [S10](./s10-settings.md)                  | Studio settings: defaults, mode, horizon, cancellation deadline, low-credit warning; audit log | 6.6         | Waiting for mockups |
| [S11](./s11-dashboard.md)                 | Today dashboard: today's lessons and the exceptions to act on                                  | 6.6         | Waiting for mockups |

The order follows dependencies: the lesson panel (S01) is opened from every
later lesson surface, the create form (S02) is reused by the calendar (S03),
and the billing blocks (S06) are reused by packages (S07) and the group page
(S08). Steps may be reordered by the owner; a later step never waits for an
earlier one unless its brief says so.

## States every step must cover

- Loading (skeletons shaped like the content), empty, error with retry.
- Phone layout (390): dialogs become bottom sheets, side panels full-screen
  sheets, tables become rows or cards.
- Ukrainian and English copy, including the longest Ukrainian strings.
- Light and dark theme.
- Destructive consequences previewed with numbers before they apply
  ("18 lessons will be cancelled").
- A conflict (`409 SCHEDULE_CONFLICT`) shows what overlaps and offers "Save
  anyway" on every path (L-111).
