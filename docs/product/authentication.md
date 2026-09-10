# Authentication Workflow

Last verified: 2026-09-09 through source and official shadcn block inspection.

## User job

“Enter my workspace quickly, or create one without having to understand the
rest of the CRM first.”

Authentication is a focused gateway, not a marketing surface. The primary
action is either sign in or create a workspace. Unsupported recovery, social
authentication, legal-consent, and promotional controls must not be implied by
the interface.

## Existing behavior to preserve

- `/login` submits email and password through the same-origin auth gateway,
  stores the resulting session through the shared query boundary, and replaces
  the route with `/app` after success.
- `/register` creates both the owner account and workspace, then replaces the
  route with `/app`.
- Registration supports `SOLO` and `SCHOOL` workspace modes. `SOLO` derives the
  workspace name from the tutor name; `SCHOOL` requires a visible workspace
  name.
- `confirmPassword` is browser-only and never reaches the API.
- Zod validation, localized API error mapping, password visibility,
  autocomplete attributes, cookie/session behavior, and duplicate-submit
  protection already exist and remain authoritative.

The current split-screen illustration and cardless form are presentation only.
They are not design authority and may be removed without changing the workflow.

## Approved F3 screen brief

### Visual direction

Use the official shadcn `login-03` and `signup-03` blocks as structural
references. The auth shell uses a full-height `bg-muted` canvas, a compact
centered column, `GraduationCapIcon` with the localized Tutorio name, and a
standard `Card`. The locale control stays outside the card in the top right.
Use only the installed `radix-luma` primitives and semantic tokens.

Remove the decorative auth illustration and its two-column layout. Do not add a
gradient, custom asset, custom shadow/radius, theme picker, or animation library.
Stock component focus, hover, and pending transitions are sufficient for this
packet.

### Sign-in hierarchy

1. Product identity.
2. Card title and concise workspace-oriented description.
3. Email field.
4. Password field with show/hide control.
5. Primary sign-in button.
6. Registration link inside the card footer area.

Request failures render as a destructive `Alert` above the fields without
clearing user input. The form keeps one obvious primary action.

### Registration hierarchy

Registration remains one page and one submission. Do not introduce a wizard or
stepper.

1. Product identity.
2. Card title and concise description.
3. A labelled workspace-mode group with two descriptive choices: solo tutor or
   multi-teacher school.
4. Tutor name.
5. Workspace name only when `SCHOOL` is selected.
6. Email.
7. Password and confirmation as separate vertical fields.
8. Primary create-workspace button.
9. Sign-in link inside the card footer area.

The sign-in card uses a `max-w-sm` column. Registration may use `max-w-md` so
the descriptive mode choices remain readable. Both pages remain single-column.

### Component boundary

Compose existing `Card`, `FieldGroup`, `Field`, `FieldSet`, `FieldLegend`,
`FieldLabel`, `FieldDescription`, `FieldError`, `Input`, `InputGroup`,
`RadioGroup`, `Alert`, `Button`, and `Spinner` primitives. Reuse the existing
`PasswordInput` and `LocaleSwitcher`.

One feature-owned auth panel may be introduced because login and registration
share the same semantic shell. Keep API mutations and navigation in thin
runtime containers; keep the visual forms deterministic and backend-independent
so Storybook does not require a session, API server, or global query provider.

## Responsive and accessibility contract

- Desktop centers the card when it fits; long registration content may scroll
  naturally.
- Mobile uses normal document scrolling, safe page padding, full-width actions,
  and no horizontal overflow or clipped controls at 320px.
- Labels remain visible; placeholders do not replace them.
- Validation uses `data-invalid`, `aria-invalid`, field errors, and focus on the
  first invalid field.
- Request errors use an announced alert and retain entered values.
- Keyboard submission, password toggle operation, focus visibility, and focus
  order remain complete.
- Pending submission disables the primary action and displays `Spinner` without
  changing the button width.
- Ukrainian and English copy must fit without truncating actions or labels.
- Light and dark themes use the same semantic token structure.

## Required states and evidence

Storybook and interaction coverage must include:

- login default, validation error, request error, pending, password visible,
  mobile, dark, Ukrainian, and English states;
- registration default `SOLO`, `SCHOOL` with workspace name, validation error,
  email-taken request error, pending, mobile, dark, Ukrainian, and English
  states;
- auth-shell narrow and desktop compositions;
- successful keyboard submission, invalid submission, password toggle, mode
  change, conditional workspace-name behavior, and navigation links;
- automated accessibility checks for every story.

Visual acceptance requires direct inspection of login and registration at
desktop and 320px widths in both themes and both locales. The production build,
Storybook browser suite, and static Storybook build must pass.

## Non-goals

- Social authentication.
- Password reset or recovery.
- Remember-me controls.
- Terms or privacy acceptance UI without corresponding product routes.
- Promotional content or decorative imagery.
- Changes to authentication APIs, cookies, workspace-mode semantics, or session
  lifetime.
