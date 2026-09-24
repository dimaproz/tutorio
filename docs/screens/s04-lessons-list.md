# S04 — Lessons List and Bulk Cancel

- Status: Waiting for mockups
- Work packet: 6.4 (screens)
- Depends on: S01 (panel)

## User job

Find lessons that need attention — unpaid, cancelled, missed, waiting for a
makeup — filter by teacher, student, group and period, and cancel a whole
period at once (holiday, illness).

## Route

`/app/lessons` with two tabs: **List** (this step) and **Schedules** (S05) —
replaces the former "Lesson patterns" item (page map). `?lesson=<id>` opens the
S01 panel.

## Screens and dialogs

1. **List**: date and time, student or group, teacher, status, kind, price and
   paid state; paged; newest first with a sort switch.
2. **Quick filters** with counts: unpaid, cancelled, no-show, needs a makeup.
3. **Filters**: period, teacher, student (their own and their groups'
   lessons), group, status.
4. **Bulk cancel dialog**: a period, one teacher or the whole studio, a
   reason; a preview "18 lessons will be cancelled" with the list; free,
   cancelled by the teacher (L-54).
5. Empty (no lessons, no match for the filters), loading, error.

## Data available

- `GET /lessons/list?page=&pageSize=&from=&to=&teacherId=&studentId=&groupId=&status=&filter=&order=`
  — paged items (with `charges[].paid`) and `counts` (`unpaid`, `cancelled`,
  `noShow`, `needsMakeup`).
- `POST /lessons/bulk-cancel/preview` and `POST /lessons/bulk-cancel` —
  `from`, `to`, `teacherId?`, `reason`.

## Rules

L-51, L-52, L-54, L-60, L-82, L-90, page map "Lessons — List".

## Reuse

`PageHeader`, `CollectionFrame`, `DataTable` (desktop), `LessonItem` rows
(phone), `SearchField`, `FilterPill`, `Segmented` (tabs), `ListPagination`,
`EmptyState`, `AdaptiveDialog`, `Notice`.

## What the mockups must show

- [ ] Desktop table and phone rows.
- [ ] Each quick filter with its count, and the active filter state.
- [ ] Filters panel on the phone.
- [ ] Bulk cancel: form, preview with numbers, done.
- [ ] Empty, no results for filters, loading, error.

## Out of scope

The Schedules tab (S05); the calendar (S03).

## Open questions

- Is bulk cancel on this page only, or also on the calendar?
- Do rows show the teacher when the studio is in solo mode?
