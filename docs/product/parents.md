# Parent Workflow and Work Packet 6.1 Screen Brief

Last verified: 2026-09-23 through source inspection, the full lint,
typecheck, unit, production build and Storybook browser/accessibility gate.
Status: Work Packet 6.1 implementation is complete; independent review is
pending.

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

The subtitle says what is shown: the record count and how many are linked, the
filtered student, the unlinked filter, or that the search matched nothing.
Picking a student or "No students" clears the other, and "Reset" clears both.

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
  explicit, retryable state.
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
`PATCH /students/:id { parentIds }`) through `useLinkedSet`: the last sent set
stays authoritative until a refreshed record arrives and the controls stay
disabled in between, so two quick edits never undo each other. A failed save
shows the error with a retry of the same set. Student mutations invalidate the
parent graph and parent mutations the student graph, so a link made on one
side appears on the other without a reload.

Unlinking asks first, and the confirmation is **neutral**: nothing is deleted,
the record stays in its section and can be linked again. The red confirmation
is reserved for deleting the parent record itself.

## Component ownership

- Shared (Layer 2): `LinkPicker`, `LinkPickerDialog`, `LinkedCard`,
  `DangerZone`; `PersonItem` gains `href` and `menu`, `ProgressMeter` puts its
  caption on its own line, `ProfileHero` gains a `menu` slot, and `Card` a
  `danger` tone. `useLinkedSet` and `useLeaveGuard` live in `src/hooks`.
- Parents feature (`features/parents`): the collection, row cells and card,
  the profile and its cards, the form pages, `ParentQuickCreateDialog` (the
  student side's "Create a new contact") and the delete hook. The legacy
  `components/parents` modules are removed.

## Storybook and test contract

- Shared: `Shared/Form/LinkPicker`, `Shared/Form/LinkPickerDialog`,
  `Shared/Cards/LinkedCard`, `Shared/Form/DangerZone`, plus the updated
  `PersonItem`, `ProgressMeter`, `ProfileHero` and `Card` stories.
- Screens: `Parents/Screens/Collection`, `Profile`, `Form` and `Student side`
  run the real feature against the story backend, including owner and
  non-owner delete visibility, filtered and empty-search states, linking and
  neutral unlinking from both sides, and two quick edits in a row.
- Model tests cover the form schema, DTO builders, section status and the
  derived role line; API E2E covers email, the link filter and the sort.

## Open product decisions

- Relation (mother, guardian…) and a payer flag: not stored; raise before
  adding a field.
- A student schedule view to link to from a student row: the row offers
  "Schedule a lesson" until one exists.
