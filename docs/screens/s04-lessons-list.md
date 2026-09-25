# S04 — Lessons List and Bulk Cancel

- Status: Done (2026-09-25, commits `8dfe70f`…`c34c0c8`)
- Work packet: 6.4 (screens)
- Depends on: S01 (panel), S03 (the calendar header)

## User job

Find lessons that need attention — unpaid, cancelled, missed, waiting for a
makeup — filter by teacher, student, group and period, and cancel a whole
period at once (holiday, illness).

## Route

`/app/lessons`, the second navigation item («Заняття», `ClipboardListIcon`).
Schedules are a page of their own (`/app/schedules`, S05), not a tab here.
`?lesson=<id>` opens the S01 panel.

## Screens and dialogs

1. **List**: date and time, student or group with the kind, teacher, status,
   payment and price; paged; newest first with a sort switch.
2. **Quick filters** with counts: all, unpaid, cancelled, no-show, needs a
   makeup.
3. **Filters**: period, teacher, student (their own and their groups'
   lessons) or group, status; a name search.
4. **Bulk cancel dialog** «Скасування занять»: a period, one teacher or the
   whole studio, a reason; the check step lists what is cancelled by day;
   free, cancelled by the teacher (L-54).
5. Empty (no lessons, no match for the filters), loading, error, solo mode.

## Data available

- `GET /lessons/list?page=&pageSize=&from=&to=&teacherId=&studentId=&groupId=&status=&filter=&order=&search=`
  — paged items (with `charges[].paid`) and `counts` (`all`, `unpaid`,
  `cancelled`, `noShow`, `needsMakeup`).
- `POST /lessons/bulk-cancel/preview` and `POST /lessons/bulk-cancel` —
  `from`, `to`, `teacherId?`, `reason`.

## Rules

L-51, L-52, L-54, L-60, L-82, L-90, page map "Lessons — List".

## Reuse

`PageHeader`, `CollectionFrame`, `DataTable` (desktop), `DateTile` (phone
cards), `SearchField`, `FilterPill`, `Segmented`, `ListPagination`,
`EmptyState`, `AdaptiveDialog`, `ChoiceCardGroup`, `ImpactList`,
`DateField`, `EntityPicker`, `Notice`, the S01 panel and its dialogs.

## What the mockups must show

- [x] Desktop table and phone rows.
- [x] Each quick filter with its count, and the active filter state.
- [x] Filters panel on the phone.
- [x] Bulk cancel: form, preview with numbers, done.
- [x] Empty, no results for filters, loading, error.

## Out of scope

Schedules (S05); the calendar (S03); recording a payment (S06).

## Mockups

The owner's handoff `tutorio-s04-lessons-list`: boards «LessonsList» (14
desktop states, 10 phone states), «BulkCancel» (7 states) and
«CalendarBulkEntry» (desktop and phone), 1440 and 390, light and dark, with
the canvas source. The repository does not keep mockups.

| NN              | State                              | Story (`Lessons/Screens/LessonsList`)                |
| --------------- | ---------------------------------- | ---------------------------------------------------- |
| 01              | Список                             | Playground                                           |
| 02              | Швидкий фільтр · Без оплати        | QuickUnpaid (QuickFilter writes the URL)             |
| 03              | Швидкий фільтр · Без відпрац.      | QuickNeedsMakeup                                     |
| 04              | Період · меню                      | PeriodMenu                                           |
| 05              | Викладач · меню                    | TeacherMenu                                          |
| 06              | Учень або група · меню             | WhoMenu                                              |
| 07              | Статус · меню                      | StatusMenu                                           |
| 08              | Фільтри застосовано                | FiltersApplied                                       |
| 09              | Меню рядка                         | RowMenu                                              |
| 10              | Нічого не знайдено                 | NoResults                                            |
| 11              | Ще немає занять                    | Empty                                                |
| 12              | Завантаження                       | Loading                                              |
| 13              | Помилка                            | LoadError                                            |
| 14              | Соло-режим                         | Solo                                                 |
| Bulk 01–02      | Форма                              | BulkCancelForm                                       |
| Bulk 03         | Помилки                            | BulkCancelErrors                                     |
| Bulk 04, 06, 07 | Перевірка, скасовуємо, готово      | BulkCancelApply                                      |
| Bulk 05         | Нічого скасовувати                 | BulkCancelNothing                                    |
| Phone 01–10     | List, filters, states, bulk cancel | PhoneList, PhoneFilters (and the toolbar's viewport) |
| Calendar entry  | Button in the calendar header      | `Calendar/Screens/Calendar` (header)                 |

Checked at 1440 and 390, light and dark, Ukrainian and English.

## Decisions (with the owner, from the handoff)

1. **Lessons and Schedules are separate pages.** The brief's tabs «Список /
   Розклади» are dropped: `/app/lessons` is the list, `/app/schedules` is
   S05.
2. **Navigation.** Sidebar: Календар · Заняття · Розклади · Учні · Групи ·
   Батьки. Phone tab bar: Календар · Заняття · Учні · Групи · Ще; «Батьки»
   and «Розклади» are under «Ще».
3. **Quick filters** are the standard `Segmented` (surface) with counts: Усі
   · Без оплати · Скасовані · Не прийшли · Без відпрацювання, as on Students.
4. **Filters** are `FilterPill`s: period (always set, pressed), teacher,
   student or group, status; the sort «Спочатку нові» on the right; the
   search on the quick filter row.
5. **Table** (the `DataTable` rows look): date and time · student or group
   (avatar or the group tile) with the kind · teacher · status (plus a
   «Відпрацювання» or «Без відпрацювання» chip) · payment · price (a group's
   with «з учня») · row menu. Rows open the S01 panel.
6. **Payment cell** from `charges[].paid`.
7. **Bulk cancel** is the outline «Скасування занять» (`CircleSlash`) next to
   «Нове заняття», an icon button on phones, and the same in the calendar
   header.
8. **Bulk cancel is two steps**: form → check. The check lists the lessons by
   day and says makeups are assigned by hand and appear under «Без
   відпрацювання».
9. **Paging** in the table card's footer on desktop, under the cards on
   phones.
10. **Solo mode** hides the teacher column and the teacher filter.

## Data (answers to the handoff's section 4)

1. **The list, quick filters and paging**: `GET /lessons/list`. This step
   adds to the API: several statuses at once (`status=A,B` — the status menu
   is a multi-select), a name search (`search`: the student's, the group's or
   the teacher's name) and `counts.all` («Усі» keeps its number while a quick
   filter narrows the page).
2. **Header subtitle**: all lessons of the period (`counts.all`), this week's
   (`total` of the same read for the current week, one row) and the unpaid
   ones (`counts.unpaid`).
3. **Menus**: `GET /teachers`, `GET /students`, `GET /groups` (search inside
   the menu). **The per-item counts of the teacher, student and status menus
   have no read** and are left out.
4. **Payment cell**: held and paid «Оплачено»; `DEBT` «Борг»; a balance
   charge not reached by payments «Не оплачено»; a group «N з M оплатили»
   from its charges; a package credit, and a scheduled lesson of a
   package-paid direction, «Пакет · 3 з 8» — the state of the package the
   direction pays with now (the owner, 2026-09-25: 3 left of 8), from the
   page read's `packages` (the oldest valid package with a credit left,
   else the latest valid one); any other scheduled lesson «Оплата після»;
   price 0 «Безкоштовне»; cancelled free «Без списання». **A scheduled
   group's head count («6 учнів») has no read** and is left out.
5. **Bulk cancel**: `POST /lessons/bulk-cancel/preview` (`count`,
   `byTeacher`, `lessons` ≤ 200, `truncated`) and `POST /lessons/bulk-cancel`;
   the split «10 індивідуальних · 4 групових» is counted from `lessons`; the
   period is `[from, to)` (the «По» day is included) and at most 366 days;
   the reason chips fill `reason`. **«27 учнів» has no read** and is dropped.
6. **The row menu's «Позначити оплату»** needs the payment form (S06) and
   is left out.

## Decided while building (for the owner's confirmation)

- **Times are a 24-hour clock in the studio's zone**, the calendar's clock
  (its formatter moved to `lib/i18n/local-formatter` for both screens); the
  periods run between the studio's midnights (since 2026-09-25).
- **The default period is this month**; a custom period includes its last
  day. «Скинути фільтри» on the empty result also resets the quick filter,
  the search and the period.
- **The row menu offers only what the panel offers** for that lesson: «Перенести»
  and «Скасувати» for a scheduled one, «Призначити відпрацювання» for a missed
  or cancelled individual one; each opens the S01 panel with that dialog.
- **A student filter replaces a group filter** in the URL (one «Учень або
  група» pill).
- **The bulk cancel's «Показати»** opens the Lessons page on the cancelled
  period (from the calendar too).
- **The split «10 індивідуальних · 4 групових»** is left out when the preview
  names only its first 200 lessons.
- **The status menu's lines**: Заплановані, Завершені, Скасовані (both
  cancelled statuses), Не прийшли.

## Open questions

- Per-item counts in the teacher, student and status menus.
- A scheduled group's head count («6 учнів») in the payment cell.
- «Позначити оплату» in the row menu (with S06).
