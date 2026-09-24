# S09 — Teachers

- Status: Waiting for mockups
- Work packet: 6.2
- Depends on: nothing (reuses the Students and Parents patterns)

## User job

Keep the studio's teachers: add one, see their students, groups and lessons,
set their default rate and calendar colour, archive and restore them; switch
between solo tutor and studio mode.

## Routes

`/app/teachers`, `/app/teachers/[teacherId]`, `/app/teachers/new`,
`/app/teachers/[teacherId]/edit` — a new navigation item (hidden or reduced
in solo mode).

## Screens and dialogs

1. **Collection**: name, subjects, students and groups count, status;
   search and status filter.
2. **Profile**: contacts, default rate, colour, the teacher's groups, students
   and lessons (`LessonList`), schedules.
3. **Form** (full page, as students and parents): name, email, phone,
   Telegram, subjects, default rate and currency, colour, bio, notes.
4. **Archive / restore** with consequences (their schedules and lessons).
5. **Solo mode**: the owner is the only teacher; switching to solo is refused
   while a second active teacher exists (`SOLO_MODE_SINGLE_TEACHER`).

## Data available

- `GET` / `POST /teachers`, `GET` / `PATCH` / `DELETE /teachers/:id`,
  `POST /teachers/:id/restore` — name, contacts, bio, default rate and
  currency, colour, avatar, status, notes. `Teacher.subjects` is stored but
  not in the API contract yet; it is added in this step if the mockups show
  subjects.
- `GET /groups?teacherId=`, `GET /lessons/list?teacherId=`,
  `GET /schedules?teacherId=`.

## Rules

[`product/scheduling.md`](../product/scheduling.md) L-40 (substitution) and
L-110 (teacher conflicts); ADR 0004 (owner-operated pilot).

## Reuse

The Students and Parents screen compositions: `CollectionFrame`, `DataTable`,
`ProfileHero`, `InfoCard`, `LinkedCard`, `FormPageLayout`, `TextField`,
`AvatarPicker`, `DangerZone`, `StatusSelect`.

## What the mockups must show

- [ ] Collection (desktop and phone), empty, one teacher in solo mode.
- [ ] Profile with groups, students and lessons.
- [ ] Form, including the colour choice.
- [ ] Archive with consequences.

## Out of scope

Teacher logins and permissions (the pilot is owner-operated); working hours
(L-121).

## Open questions

- Does a teacher have a login in the pilot, or only a profile?
