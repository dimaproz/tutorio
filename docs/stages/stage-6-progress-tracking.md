# Stage 6 — Learning Progress Tracking

> **Outcome:** the tutor can record what actually happened in lessons — topics,
> homework, test results, attendance — and (via Telegram) deliver homework. This
> is the content that later powers the student portal (Stage 10).
>
> **Pillar:** Student · **Status:** Planned · **Depends on:** Stage 3 (`Lesson`
> for optional links), benefits from Stage 5 (Telegram send channel).

## 1. Goal & non-goals

**Goals** (schema loosened per the production audit — decisions #11–14)
- `ProgressEntry` — `date`, `topic?`, `homework: n_a|done|not_done`,
  `engagement? (1–10)`, `notes`. **Not** required to link to a `Lesson`.
- `TestResult` — `date`, `type: quiz|independent_work|test|…`, optional
  `lessonId`, `name`, `topic?`, `scoreValue`, `scoreMax`, `passingScore?`,
  `notes`.
- `LessonJournalEntry` — `date`, `title`, `description`, `homeworkText?`,
  `sentToTelegramAt?`, `attachments[]`. Homework is a **field on the journal
  entry**, not its own entity.
- `AttendanceRecord` — `lessonId`, `studentId`, `status:
  present|absent_paid|absent_unpaid` (tri-state, for group lessons).
- Surface as tabs on the student detail page + a standalone Progress page for
  picking a student or a whole group.

**Non-goals**
- No grading scales/curricula; no student-visible view yet (that's Stage 10 —
  this stage only *captures* the data).

## 2. Domain / model
All four entities per mvp-plan schema, workspace-scoped, soft-deletable.
Attachments: store keys (object storage) not blobs; `attachments[]` holds keys +
metadata. `TestResult` pass/fail is derived (`scoreValue >= passingScore`), not
stored.

## 3. Domain logic (`packages/domain`)
Thin — pass/fail derivation, engagement clamp (1–10), attendance tri-state
guards. Most of this stage is CRUD, not rules.

## 4. Validation
`CreateProgressEntryDto`, `CreateTestResultDto`, `CreateJournalEntryDto`
(+ attachment refs), `UpsertAttendanceDto` (batch per group lesson).

## 5. API — `progress` module
- CRUD for the three entities + attendance upsert (batch for a group lesson).
- `POST /journal/:id/send-telegram` — calls the Stage 5 `telegram.sendHomework`.
- Attachment upload: pre-signed URL endpoint (upload direct to storage).

## 6. Web — `features/progress`
TailAdmin reference: **tabs + timeline/journal list**, **form-in-drawer** for
add-entry, **rating stars** for engagement.
- Student detail page: `Progress`, `Tests`, `Journal` tabs.
- Standalone `/app/progress` route with student/group picker.
- Group attendance grid (tri-state legend: present / absent-paid / absent-unpaid).

## 7. Sequencing
Model + migration → validation → `progress` module CRUD → attachments
(pre-signed) → journal Telegram send → web tabs → standalone page → group
attendance.

## 8. Testing
- Domain: pass/fail derivation, engagement clamp, attendance guards.
- API: CRUD scoping; attendance batch upsert idempotent; send-telegram marks
  `sentToTelegramAt`.
- Web: add-entry interaction tests; tabs render; attendance grid toggles.

## 9. Definition of Done
Global DoD + : a journal entry with homework can be sent to Telegram; group
attendance persists tri-state; all three entry types show on the student page.

## 10. Risks & decisions
- **Attachments** — never store blobs in Postgres; keys + object storage +
  pre-signed uploads; validate content-type/size.
- **Over-modelling** — keep progress entries loose (audit decision #11); resist
  turning them into a gradebook.
