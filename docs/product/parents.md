# Parent Workflow and Work Packet 6.1 Screen Brief

Last verified: 2026-09-23 through source inspection, the full lint,
typecheck, unit, production build and Storybook browser/accessibility gate,
and API E2E on an isolated PostgreSQL 17. Status: Work Packet 6.1 is closed —
implemented, independently reviewed in four slices, and remediated.

Parents are the sibling of Students, not a variant: the same Studio
"Indigo & Sky" look, full pages instead of dialogs, both themes and phone
layouts. The handoff screens are the design authority; where this brief and a
screen disagree, the screen wins.

## User job

"Keep the people who pay for and speak for my students one tap away, and
know which student each of them belongs to."

A parent becomes useful the moment it is linked to a student: the tutor can
call or message them from either profile and see the whole family at a glance.

## Scope and authority

Work Packet 6.1 owns:

- `/app/parents` — the collection;
- `/app/parents/new` — create;
- `/app/parents/[parentId]` — the profile;
- `/app/parents/[parentId]/edit` — edit, with the danger zone;
- the parent ↔ student linking and unlinking flows, from both sides;
- the four shared components the flows need (`LinkPicker`,
  `LinkPickerDialog`, `LinkedCard`, `DangerZone`) and two changes to
  existing ones (`PersonItem` row link and menu, `ProgressMeter` caption).

It does not change the student screens beyond the parents card on the student
profile and the two shared-component changes.

All parent API routes are owner-only in the pilot. Delete is owner-only and
irreversible, so every delete entry point — the row menu, the profile `…` menu
and the danger zone — is hidden for anyone else, not disabled on click.

## Data contract

`Parent` is `{ fullName, email?, phone?, telegramUsername?, avatarKey?, notes? }`
plus timestamps; `StudentParent` carries only the two ids.

- **Email** is stored (migration `20260923120000_parent_email`), validated and
  normalized like a student's, searchable, and shown on the profile and the
  form.
- **The role line is derived**, not stored: "Parent of Anna, Mark" from the
  linked students (one student by full name, several by first name), or
  "No students". A relation (mother, guardian) and a payer flag are a product
  decision that has not been made; the screens read correctly without them.
- **The list query** answers the student filter (`studentId`), the "no
  students" filter (`linked=none`) and the sort (`sort=fullName|createdAt`,
  `order`). Nothing is filtered or sorted on the client.
- The student ref on a parent's roster carries `languageLevel`, the second
  line of a student row on the parent side.

## Screen 1 — Collection

`CollectionFrame`, `PageHeader`, `SearchField`, `EntityPicker` behind a
`FilterPill`, a pressed `FilterPill` for "No students", a sort pill, the
`DataTable` rows variant and `ListPagination`. There is deliberately no stats
row.

| Column   | Content                                                      |
| -------- | ------------------------------------------------------------ |
| Parent   | Avatar, the name as the row link, the derived role line      |
| Phone    | Mono figures, or a dash                                      |
| Telegram | Send glyph and `@handle` in the brand colour, or a dash      |
| Students | Overlapping avatars and names, or a "No students" badge      |
| Actions  | Open profile, call, edit; delete under a divider, owner only |

The subtitle says what is shown: the record count and how many are linked
(once that count has loaded), the filtered student, the unlinked filter, or
that the search matched nothing. Picking a student or "No students" clears the
other, and "Reset" clears both; the API also ignores `linked=none` when a
student filter is set. The search field follows the URL, so "Clear search"
empties it, and both commands return focus to the search field. A page number
past the end steps back to the last page. Phones get the sort as a pill in the
filter row.

Phones get `ParentCard`: identity with an arrow, then the linked students and
one-tap call / Telegram buttons that sit above the card link.

States: loading skeleton; query error with retry; true empty (no toolbar, one
"Add parent"); search with no hits ("Clear search", a secondary button with an
✕, never a second create); filters with no hits ("Reset filters").

## Screen 2 — Profile

`ProfileHero` (avatar, "Added" chip, name, the role line and a count for two
or more students, contact buttons, "Link a student" primary, "Edit"
secondary, and a `…` menu carrying only "Delete record"), then three cards:
linked students (`LinkedCard`), contact details (`InfoCard` + `ContactRow`,
with a missing contact turned into the link that adds it) and notes (edited in
place). There is no status control: parents have no lifecycle.

Phones stack the hero and the cards; the primary command takes the full width.

## Screen 3 — Create and edit

Four sections — personal details, contacts, linked students, notes — with the
scroll-following `SectionNav` (chips on phones), per-section done and error
marks, a `ProgressMeter` and the sticky `ActionBar`; a full-width sticky save
on phones. Only the name is required.

- The linked-students section is a bare `LinkPicker` with a floating result
  list. The ✕ on a linked row removes it with no dialog: the change applies on
  save. "Create a new student" opens `StudentQuickCreateDialog` and adds the
  new student to the set.
- **No local draft.** Leaving a dirty create form asks once and then discards
  it; nothing is written to browser storage.
- Create success opens the new profile with a toast; edit success returns to
  the profile. A request error keeps every value and offers retry.
- Edit loads first and never falls back to a create form; a failed load is an
  explicit, retryable state. An edit sends the student links only when the
  form changed them, so a rename cannot overwrite a link made elsewhere in the
  meantime. The form caps the links at the API's 20.
- Edit ends with the `DangerZone` (owner only). Its button opens the red
  `ConfirmDialog`; after delete the tutor lands on the collection.

## Linking, from both sides

The relationship is symmetric and so is the UI. The student profile's parents
card and the parent profile's students card are the same `LinkedCard`, each
with one `LinkPickerDialog`:

- a card headed "Parents · N" / "Linked students · N" with "+ Link", one row
  per record; the row is the link to that profile;
- the row `…` menu: open profile, the contextual action (call a parent, or
  schedule a lesson for a student) and, under a divider, "Unlink" in the
  destructive colour; a read-only card (an archived student) keeps only the
  view actions and drops "+ Link";
- the picker: search, checkbox results without the already-linked records,
  "Create a new contact" / "Create a new student", and Cancel / "Link · N"
  (a bottom sheet with one full-width "Done · N" on phones).

Saving sends the whole set (`PATCH /parents/:id { studentIds }` or
`PATCH /students/:id { parentIds }`). Both cards run on `useRelationshipLinks`
and `useLinkedSet`: the last sent set stays authoritative until a record that
arrived after the send replaces it, a failed save falls back to the last saved
set rather than a stale record, and the controls stay disabled while a save
runs and while the record itself refreshes. So two quick edits never undo each
other, even right after the other side changed the link. A failed save
shows the error with a retry of the same set. Student mutations invalidate the
parent graph and parent mutations the student graph, so a link made on one
side appears on the other without a reload.

Unlinking asks first, and the confirmation is **neutral**: nothing is deleted,
the record stays in its section and can be linked again. The red confirmation
is reserved for deleting the parent record itself.

## Component ownership

- Shared (Layer 2): `LinkPicker`, `LinkPickerDialog`, `LinkedCard`,
  `DangerZone`, and — promoted by the review because Students and Parents had
  copies — `FormPageLayout` and `NotesCard`. `PersonItem` gains `href` and
  `menu`, `ProgressMeter` puts its caption on its own line, `ProfileHero` gains
  a `menu` slot, `ConfirmDialog` returns focus, and `Card` gains a `danger`
  tone. `useRelationshipLinks`, `useLinkedSet`, `useReturnFocus` and
  `useLeaveGuard` live in `src/hooks`; `filteredRegistration` and the phone and
  Telegram filters in `lib/forms/input-filters`.
- Parents feature (`features/parents`): the collection, row cells and card,
  the profile and its cards, the form pages, `ParentQuickCreateDialog` (the
  student side's "Create a new contact") and the delete hook. The legacy
  `components/parents` modules are removed.

## Storybook and test contract

- Shared: `Shared/Form/LinkPicker`, `Shared/Form/LinkPickerDialog`,
  `Shared/Cards/LinkedCard`, `Shared/Form/DangerZone`,
  `Shared/Form/FormPageLayout` and `Shared/Cards/NotesCard`, plus the updated
  `PersonItem`, `ProgressMeter`, `ProfileHero` and `Card` stories.
- Screens: `Parents/Screens/Collection`, `Profile`, `Form` and `Student side`
  run the real feature against the story backend, including owner and
  non-owner delete visibility, filtered and empty-search states, linking and
  neutral unlinking from both sides, and two quick edits in a row.
- Model tests cover the form schema, DTO builders, section status and the
  derived role line; API E2E covers email, the link filter and the sort.

## Independent review — 2026-09-23

Four reviewers, each given only the diff and the contracts, covered frontend
correctness, the API and contract, design-system compliance, and
accessibility with responsive layout. None found a blocker. Every confirmed
finding was fixed, with tests or stories where behavior changed:

- **Correctness.** The phone and Telegram filters ran after react-hook-form
  had stored the value, so a pasted `ivan.petrenko` looked clean and failed on
  submit; the student form had the same defect. Both now use
  `filteredRegistration`. "Clear search" kept the old text in the field; the
  field now follows the URL. `useLinkedSet` could build on a stale set after a
  failed save that followed a failed refresh, and a link made on the other side
  could be undone from a cached record; a sent set now expires only with a
  newer record, and a refreshing record holds the controls. Also fixed: edits
  send links only when changed, a page past the end steps back, the subtitle
  waits for its count, the footer range follows the loaded page, the hero's
  link command waits for a running save, and the form enforces the 20-link cap.
- **API.** The list description and the generated client name email, `linked`
  and `sort`; `studentId` matches the roster (live students only) and wins over
  `linked=none`; the roster's `languageLevel` is the CEFR enum; the seed fills
  missing fields and adds an unlinked parent. E2E now proves that a link to an
  archived student still counts as linked, the email audit diff and the default
  name order, and cleans up in `finally`.
- **Design system.** The two linking cards were one flow written twice and had
  already drifted in status casing, role wording and contact lines; they now
  share `useRelationshipLinks` and one set of result and row mappers.
  `ParentFormLayout` and `ParentNotesCard` were clones of the student ones; both
  features now use the shared `FormPageLayout` and `NotesCard`. Also: copy moved
  into messages (keyboard hint, sort label), unused keys removed, "За ім’ям"
  corrected, `AvatarGroup` for the avatar stack, the input filters shared, the
  leave-guard re-export removed, and every extra story carries a play test.
- **Accessibility.** Focus returns from the picker and the confirmations; the
  floating results scroll within the viewport and follow the arrow keys; adds
  and removals are announced and a removed row hands focus on; phone targets
  are at least 44px; sort is available on phones and marks the current choice;
  the student filter is no longer announced as a toggle; option names drop the
  avatar initials; empty results are announced; Telegram links say they open a
  new tab.

Declined, with reasons:

- Rebuilding `LinkPickerDialog` on `AdaptiveDialog`: the picker needs a close
  button, a scrolling body and a sheet without a secondary command, and
  changing `AdaptiveDialog` would change the student hold dialog. Revisit when
  a third adaptive dialog appears.
- A compact `EmptyState` for the picker's "nothing linked" line, joining names
  with `Intl.ListFormat`, and removing `LinkedCard.addHref` / `actions` and the
  framed `LinkPicker` header: these follow the approved component spec or are
  matters of taste, not contract breaks.
- `DangerZone` keeps the archive glyph by default, as the handoff specifies.
- The Parents ↔ Students barrel cycle stays: each side uses the other only
  inside components.

## Open product decisions

- Relation (mother, guardian…) and a payer flag: not stored; raise before
  adding a field.
- A student schedule view to link to from a student row: the row offers
  "Schedule a lesson" until one exists.
