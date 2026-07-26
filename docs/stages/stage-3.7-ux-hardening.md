# Stage 3.7 — UX Hardening ("usable today")

> **Outcome:** a tutor opens Tutorio every morning instead of a notebook and
> Google Calendar. No new domain concepts — this stage removes friction on top
> of the Stage 3 scheduling core so the product is usable before the money loop
> lands.
>
> **Pillar:** Scheduling · **Status:** Next · **Depends on:** Stage 3, 3.6.
> **New (beyond mvp-plan):** yes — this stage is a product-review addition.

## 1. Goal & non-goals

**Goals**
1. Kill the dead landing screen — a real "Today" dashboard.
2. Remove the word *enrollment* from the tutor's vocabulary in scheduling flows.
3. Make the student detail page the scheduling hub (see + book lessons in place).
4. Bring scheduling forms up to the shared `EntityPicker` standard.
5. Let tutors capture per-lesson notes.
6. Be honest that billing is not wired yet (transitional).

**Non-goals**
- No ledger, balances, or payments (Stage 4).
- No analytics widgets beyond "today/this week" counts (Stage 5).
- No Telegram (Stage 5), no student-facing surface (Stage 7).

## 2. Domain / model

No Prisma schema changes. Two backend behaviours are needed:

- **Auto-resolve enrollment on lesson create.** New service capability: given a
  `studentId` (+ optional `groupId`), resolve the active `Enrollment`, or create
  a default one from `Student.hourlyRateMinor`/`Group.pricePerLesson` +
  `Teacher.defaultRateMinor`. Lives in `enrollments.service` as
  `resolveOrCreateDefault(...)`, called by `lessons.service.create`.
- **Expose `Lesson.notes`** through the update DTO (field already on the model).

## 3. Domain logic (`packages/domain`)

None new. The default-price selection (student → group → teacher fallback order)
is a pure function — add `resolveDefaultPrice(inputs): { minor, currency }` with
vitest cases (student rate wins; group fallback; teacher fallback; none → null).

## 4. Validation (`packages/validation`)

- `CreateLessonDto`: make `enrollmentId` optional; add `studentId` + optional
  `groupId`. Refine: exactly one of `enrollmentId | studentId` present.
- `UpdateLessonDto`: add optional `notes: string | null`.
- Keep DTOs shared; regenerate `api-client`.

## 5. API (NestJS)

- `lessons.service.create`: accept the new shape; when `studentId` given, call
  `enrollmentsService.resolveOrCreateDefault` inside the existing transaction
  (so the audit entry and any created enrollment commit atomically). Preserve
  the 409-conflict path and `force`.
- `lessons.service.update`: persist `notes`.
- `enrollments.service.resolveOrCreateDefault`: workspace-scoped; picks the
  single active enrollment for (student, teacher) or creates one with
  `resolveDefaultPrice`. Audited in-transaction.
- **Dashboard data:** reuse `GET /lessons?from&to` (already exists) — no new
  endpoint for "today"; the web queries the current-day range.

No owner-only gating here (teachers schedule).

## 6. Web (`apps/web`)

TailAdmin references to mirror first: **dashboard "today" list** →
`demo.tailadmin.com/analytics` (recent-activity / list card); **person picker**
→ existing `EntityPicker` (already the standard).

### 6.1 Dashboard "Today" — `features/dashboard`
Replace `DashboardEmptyState` in
[components/app/dashboard.tsx](../../apps/web/src/components/app/dashboard.tsx):
- Today's lessons list (time, student/group, teacher, status badge); click →
  existing `LessonActionsDialog`; row action → complete/cancel.
- A compact "this week" count + "next lesson" hint.
- Uses `useLessonsQuery({ from: startOfDay, to: endOfDay })`.
- Empty state only when there are genuinely no lessons today.

### 6.2 De-jargon the lesson form —
[components/scheduling/lesson-form-dialog.tsx](../../apps/web/src/components/scheduling/lesson-form-dialog.tsx)
- Replace the plain `Select` of enrollments with `EntityPicker` over **students**
  (search + avatar), per the AGENTS contract.
- On pick: fetch/derive the default price (from student/group/teacher); prefill
  and let the tutor override. Submit `studentId` (+ `groupId`), not
  `enrollmentId`.
- Auto-select the teacher when the workspace has exactly one; otherwise an
  `EntityPicker` over teachers.
- Do the same in `series-form-dialog.tsx`.

### 6.3 Student page as hub —
[components/students/student-detail.tsx](../../apps/web/src/components/students/student-detail.tsx)
- New card: **Upcoming lessons** + **Past lessons** (paged) for this student,
  reusing scheduling queries filtered by the student's enrollments.
- "Add lesson" button opens `LessonFormDialog` with the student pre-selected.

### 6.4 Lesson notes
- Add a `notes` textarea to the lesson create/edit path and show it in
  `LessonActionsDialog`.

### 6.5 Honest billing state (transitional)
- In `LessonActionsDialog` cancel step, a muted hint that financial effects
  arrive with the Finance module. Remove in Stage 4.

## 7. Sequencing (ordered, shippable sub-slices)

1. Dashboard "Today" (pure read; highest value/cost). → ship
2. `resolveDefaultPrice` domain fn + tests.
3. Validation DTO changes + `api-client` regen.
4. `resolveOrCreateDefault` + `lessons.create` wiring + service tests.
5. Lesson form → student `EntityPicker` + auto-teacher.
6. Student-page schedule hub + quick-book.
7. Series form picker parity; lesson notes; honest-billing hint.

## 8. Testing

- **Domain:** `resolveDefaultPrice` fallback order.
- **API:** `lessons.create` with `studentId` creates/reuses enrollment; conflict
  still 409; `notes` persists. Supertest smoke: create student → book lesson by
  studentId with no prior enrollment → lesson exists.
- **Web:** lesson form interaction test (pick student → price prefilled →
  submit); dashboard renders today's lessons; student-page quick-book opens
  pre-filled.

## 9. Definition of Done

Global DoD + : a brand-new student can be booked a lesson without the word
"enrollment" ever appearing; dashboard shows today's lessons; notes round-trip.

## 10. Risks & decisions

- **Auto-creating enrollments could spawn duplicates.** Guard: reuse the single
  active (student, teacher) enrollment; only create when none active. Covered by
  a service test.
- **Default-price ambiguity** (student vs group vs teacher). Frozen order:
  student rate → group price → teacher default → empty (tutor must type). Encoded
  in `resolveDefaultPrice`.
- **Scope creep into Stage 4.** Hard line: this stage never writes a ledger entry
  or a payment; "charge on cancel" stays a status flag only.
