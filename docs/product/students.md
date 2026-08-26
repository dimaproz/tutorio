# Student Workflow

Last verified: 2026-08-26 through source inspection. A local authenticated
visual audit of `/app/students` and the create dialog remains acceptance work.

## User job

“Add the learner I am about to teach, then help me do the next useful thing.”

The create action is not a complete CRM profile setup. A student becomes useful
when the tutor can schedule a lesson, create a lesson package, place the student
in a group, or link a guardian.

## Current experience

The list is a strong base: search, filters, sorting, pagination, mobile cards,
loading, error, and empty patterns already exist. The create dialog is the main
problem.

The visible dialog currently asks for eight sections in one scroll container:

1. Avatar.
2. Name and status.
3. Email, phone, and Telegram.
4. Timezone.
5. Language level, knowledge level, age, and grade.
6. Price and currency.
7. Existing or newly created parents.
8. Notes.

Only name and timezone are required by the API, yet optional concepts dominate
the first-use path. The form implementation is over 600 lines and owns queries,
mutations, relationship reconciliation, formatting, validation, nested entity
creation, and rendering in one component
([student form](../../apps/web/src/components/students/student-form.tsx)).

### Observed usability and trust issues

- Avatar and status appear before the first useful contact, although new students
  should default to active and an avatar is enrichment.
- Timezone is auto-detected but still consumes a primary section.
- “Language level” and “knowledge level” overlap for non-language tutors.
- Price uses inconsistent “per hour” and “per lesson” language.
- Creating a parent persists it before the student. Cancelling afterward can
  leave an unintended unlinked parent.
- Submit actions are at the bottom of a long scroll area; there is no dirty-close
  warning.
- Success closes the modal and leaves the tutor on the list without a recommended
  next action.
- A filtered no-result state can incorrectly look like “no students exist.”
- Edit-load failure can fall through toward create-mode behavior rather than an
  explicit retry state.
- Permanent deletion is prominent although the backend cannot safely delete a
  student with all finance relationships.

## Target pilot flow

Do not build a multi-step wizard. The essential path is small enough for a compact
quick-create dialog with progressive disclosure.

### Quick create

| Field             | Behavior                                                                        |
| ----------------- | ------------------------------------------------------------------------------- |
| Full name         | Required and focused on open                                                    |
| Phone or Telegram | Optional; one contact row optimized for the common case                         |
| Price per lesson  | Optional; show currency only when a price is entered, defaulting from workspace |

Applied silently:

- status = active;
- timezone = workspace timezone, falling back to browser timezone;
- no avatar, parent, group, enrollment, package, or schedule side effect.

“Add more details” reveals email, alternate contact, timezone override, age or
grade, one clearly named learning-level field, and notes. Avatar belongs on the
saved profile, not before identity exists.

### Success state

Navigate to the created student profile and show a dismissible setup card:

- Schedule first lesson.
- Add lesson package.
- Add to group or start individual study.
- Link or create parent.
- Complete profile.

Each action is prefilled with the saved student and is independently cancellable.
No nested entity is persisted inside an unsaved student form.

### Edit experience

Prefer section-level editing on the profile for Identity and contacts, Learning
profile, Pricing defaults, Parents, and Notes. If a full edit modal remains as a
transition step, it requires a sticky action footer, dirty-close protection,
explicit load failure/retry, and sections that can be collapsed.

## Lifecycle experience

- `Archive student` is the normal removal action and explains treatment of future
  lessons, active enrollments, and packages before confirmation.
- Archived students are excluded from the default active list and available
  through a clear status filter.
- Restore revalidates affected operational relationships.
- Permanent deletion is owner-only, unavailable when business history exists,
  and never described as a routine cleanup action.
- Privacy erasure routes to the controlled workflow in ADR 0002.

## State and accessibility contract

- Loading: skeleton for create dependencies; never show an empty picker while a
  parent query failed.
- Validation: map server issues to fields, focus the first invalid field, and
  announce the error summary.
- Empty: distinguish no students from no filter matches; provide “Clear filters.”
- Error: create/edit/query failures retain user input and provide retry.
- Success: profile navigation plus next actions; avoid a toast-only dead end.
- Dialog: localized close label, visible action footer, focus return, Escape/overlay
  dirty confirmation, and complete keyboard operation.
- Mobile: required fields and actions fit without horizontal scrolling; detail
  sections use the existing responsive card patterns.

## Domain/API requirements before redesign

- Archive/restore is implemented: an archived student exposes Restore only and
  the API rejects ordinary profile PATCH until that command succeeds.
- Make owner-only mutation policy explicit.
- Archive suspends future individual work and temporarily removes the student
  from the operational group roster while retaining historical relationships.
- Provide an atomic API only if product evidence later requires “create student
  and parent together”; otherwise keep those jobs separate.
- Add package summary and a prefilled “Add lesson package” entry point to student
  detail.

## Acceptance criteria

- A new tutor creates a student in under one minute without explanation.
- Only the name is required when workspace/browser timezone is available.
- Cancelling the dialog creates no student, parent, enrollment, package, or lesson.
- After success the tutor can schedule or sell a package with the student already
  selected.
- Interaction tests cover success, field/server errors, dirty close, edit-load
  failure, filtered empty state, archive, restore, and parent linking.
- Desktop/mobile and Ukrainian/English pass keyboard and visible-label review.

## Implementation slices

1. Fix lifecycle/permissions and remove stale delete/restore copy and API helpers.
2. Fix edit loading/error states and filtered empty behavior.
3. Add `StudentQuickCreateDialog` with progressive details and interaction tests.
4. Add the profile setup card and prefilled operational actions.
5. Move parent linking/creation to the saved profile.
6. Split the legacy form by feature concern as its remaining edit sections move;
   do not begin another repository-wide component rewrite.
