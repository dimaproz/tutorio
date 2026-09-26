# S10 — Studio Settings

- Status: Done (2026-09-26, commits `117fb0c`…`ac518e1` and the docs commit
  after it)
- Work packet: 6.6
- Depends on: nothing

## User job

Set the studio defaults the rest of the product uses, and look up who changed
what.

## Routes

Settings are a module of separate pages, not one long form:

- `/app/settings` — the overview;
- `/app/settings/general` — «Загальне»;
- `/app/settings/lessons` — «Заняття й пакети»;
- `/app/settings/audit` — «Журнал змін».

The navigation item «Налаштування» (`SettingsIcon`, `nav.settings`) sits
after «Викладачі», owner only, in both modes. The areas are details of it: the
top bar reads «← Налаштування» and the page's name.

## Screens and dialogs

1. **Overview**: the areas in four groups (Студія, Гроші, Підключення,
   Контроль) as cards with their current values («Kyiv English Studio · ₴ UAH
   · Студія», «24 год · 4 тижні · 2 заняття», «64 записи за тиждень»);
   Реквізити, Оплати, Telegram-бот and Інтеграції are inert «Незабаром» cards.
   Phones list each group in one card with «Скоро».
2. **General**: the studio's name (editable, the owner's answer of
   2026-09-26), the timezone read only (a lock and a hint), the default
   currency as five flag tiles, the mode as two tiles with the active teachers
   and a link to them; the refusal of tutor mode (`SOLO_MODE_SINGLE_TEACHER`),
   a bottom sheet on phones.
3. **Lessons**: the free cancellation window (L-51, presets 12 · 24 · 48 h),
   how far ahead new schedules book (L-120, presets 2 · 4 · 8 weeks) and the
   package warning (L-82, 0 turns it off), each a stepper beside a picture of
   what it does.
4. Both pages save on their own: «● змінено» on a changed setting (a warning
   ring on a stepper), the sticky bar «Усі зміни збережено» or «N зміни не
   збережено» with «Скасувати» and «Зберегти», the toast «Налаштування
   збережено», and a confirm when leaving with unsaved changes.
5. **Change log**: the filter pills «Що змінили», «Дія», «Хто» and the period
   (the last 7 days by default, the last 30, this month or own dates), the
   ghost «Скинути»; the rows by day with the time, the record, the action
   badge, a one-line summary and who; a row opens into «Поле / Було / Стало»;
   «Показати ще»; no results with «Скинути фільтри»; loading, error and an
   empty log. Phones: cards, a «Фільтри» sheet with the count of set filters.

## Rules

L-50, L-51, L-82, L-120; ADR 0004.

## Reuse

`PageHeader`, `TextField` (`locked`), `ChoiceCardGroup` (new `tile`
appearance), `Flag`, `Badge`, `ActionBar`, `ConfirmDialog`, `AdaptiveDialog`,
`ImpactList`, `FilterPill`, `DateField`, `SectionDivider`, `EmptyState`,
`EntityAvatar`, `Card`, `Item`, `Collapsible`, `Drawer`, `RadioGroup`,
`DropdownMenu`, `Popover`, the sonner toast; `useLeaveGuard`,
`useUpdateSearchParams`.

## Mockups

The owner's handoff `tutorio-s10-settings`: board 01 «SettingsHub», board 02
«SettingsGeneral» (4 states), board 03 «SettingsLessons» (3 states), board 04
«AuditLog» (4 states), at 1440 and 390, light and dark, with the canvas
source. The fixture is Kyiv English Studio (Europe/Kyiv, UAH, studio mode,
5 active teachers) on Saturday 26 September 2026; the owner is Olena
Kovalenko. The repository does not keep mockups.

## Decisions (the owner's, from the handoff)

1. **One page per area.** `/app/settings` is an overview; `general`,
   `lessons` and `audit` are pages. Requisites, payments, the Telegram bot and
   integrations get a «Незабаром» card now and their own page later.
2. **Each page saves on its own** with the sticky `ActionBar`. Changed fields
   are marked «змінено» and the bar counts them. Leaving with unsaved changes
   asks to confirm.
3. **Name and timezone are read only** in the pilot — the brief's open
   question, answered. A lock and a hint say how to change them. _Revised by
   the owner on 2026-09-26: the name is editable (see below); the timezone
   stays read only._
4. **Every number explains itself** with a small picture of what it does.
5. **Changes apply to new records only.** Existing prices, packages and
   lessons do not change; the currency hint says so.
6. **The audit log lives in settings** as its own page and reads as «who
   changed what» in plain words. A soft delete reads «Архівовано».

## Data gaps (handoff section 4), answered

- **Record label.** Resolved when the log is read, not snapshotted: every row
  carries `record` — the person, group or studio's name now, a second name
  (a direction's group or teacher, a package's name), a lesson's start, a
  payment's amount, the currency of its money and a schedule's current
  weekly slots. A deleted record keeps the name its own diff carries, else
  reads «Запис видалено». One read per kind of record per page.
- **Field names and values.** A client map (`features/settings/model/audit`)
  gives each key a label and a kind; money from minor units in the diff's
  currency, else the record's; dates on the studio's clock; a colour as its
  swatch and hex; ids as names through the page's `names` map (a teacher,
  student, group, parent, package or user), otherwise «—»; empty as «—»; a
  key added to the API later still shows under its own name.
- **Summary line.** Built on the client from the first three changed fields,
  a short value pair as «a → b» and a text, colour or list by its label, then
  «, …». A new record reads by its kind and two facts («Новий учень · A1»), a
  payment «Оплата 3 200 ₴ за пакет «Жовтень»», a schedule change «Зміна з
  1 жовт.: Чт 15:00 → Чт 16:00», a lesson Tutorio held «… (автоматично після
  закінчення)».
- **System actor.** `actor: null` is Tutorio itself (L-50): no code path
  deletes a user, so no `actorKind` was added. The foreign key is `SET NULL`,
  so a user removed by hand in the database would read as Tutorio too.
- **«Хто» filter.** `GET /workspaces/current/members`, which now carries the
  avatar of each member's teaching profile.
- **The overview's count** is the log's `total` for the last seven days,
  today included.

Nothing was left out for want of data.

API changes (with tests first): `record` on every audit list row and `names`
on the page (`apps/api/src/audit/audit-records.ts`), `avatarKey` on the
member roster, and a teacher's archive logged as `DELETE` like a student's
and a group's (a hand-over from a teacher already archived stays `UPDATE`),
so the «Архівовано» badge and the «Дія» filter agree.

## Decisions taken while building

1. **Tutor mode is refused on the tile**, before a save: choosing «Репетитор»
   while colleagues teach opens the refusal and the mode stays «Студія». The
   API's refusal on save opens the same dialog; `SOLO_OWNER_MUST_TEACH` (an
   owner who stopped teaching) shows as an error toast — no board has it.
2. **The S10 refusal is its own dialog** (`ModeRefusalDialog`: two impact rows,
   «До викладачів» and «Зрозуміло»); the S09 `SoloRefusalDialog` of the
   teachers page keeps its board.
3. **Tablets (834).** The handoff has no tablet boards: General and Lessons
   are one column below 1024 px, and the log shows its cards there, as the
   six columns do not fit beside the sidebar.
4. **The phone save bar** is the same `ActionBar` above the tab bar with the
   note and «Зберегти» only; «Скасувати» is desktop only, as on the board.
5. **The horizon picture starts at this week's Monday** and fills N weeks;
   «до …» is the Sunday of the last one. The board starts at 7 September while
   its «today» is 26 September.
6. **«Показати ще»** reads pages of 20 into the same list («Показано 20 з
   64»), not 8 as on the board's excerpt. One row opens at a time.
7. **The stepper takes typing** as well as − and + (clamped to the API's
   range: 0–336 h, 1–26 weeks, 0–50 lessons).
8. **The low-credit picture** is a sample package of 8 for «Anna Shevchenko»
   (a fixed illustration, not a student of the studio); at 0 it reads «Без
   попереджень».
9. **The phone top bar** now shortens a long way back («Налашт…») instead of
   running under the page's name — a shell fix every detail page gets.
10. **Filters live in the URL** (`entity`, `action`, `actor`, `period`,
    `from`, `to`); defaults are never written.

## Open questions

Answered by the owner on 2026-09-26:

- **Payment method** — yes: a payment's audit entry now records its
  `method`, and the log reads «Переказ 3 200 ₴ за пакет «Жовтень»»,
  «Готівка …», «Картка …» (an entry without it reads «Оплата …»); the diff
  shows «Спосіб оплати».
- **Tablet layout** — confirmed as built (one column below 1024 px, the log
  as cards).
- **Older teacher archives** stay as written (`UPDATE`, «Змінено»): history
  is not rewritten; the pilot's data is test data.
- **The «Хто» filter** lists login accounts only — fine for the
  owner-operated pilot; teachers appear there once they get logins.

- **The studio's name is editable.** Nothing is keyed by it (no slug, URL or
  receipt yet), so «Загальне» takes it like any other setting: trimmed, 2–80
  characters as at registration, the «змінено» mark, the save bar and the
  log (`name` in `PATCH /workspaces/current/settings`); the hint reads «Видно
  в меню, у шапці та в журналі змін». The timezone stays read only: changing
  it would move every lesson's wall clock.

No question is open.

## Evidence

- Stories: `Settings/Screens/Hub`, `…/General` (save, a rename, «Скасувати», the solo
  refusal on desktop and phone, the leave confirm, a failed save),
  `…/Lessons` (save two changes, typing and «Скасувати», the leave confirm),
  `…/AuditLog` (the log and «Показати ще», a diff, the filtered board, a
  filter written to the URL, no results and reset, phone cards and the
  «Фільтри» sheet, loading, error, empty); `Shared/Form/ChoiceCard` `Tile`.
- Checked in Storybook at 1440, 834 and 390, light and dark, Ukrainian and
  English, against the boards; and in the running app on the local dev
  database (overview, General and the log with real entries).
- Gate: see [`current-state.md`](../current-state.md).
