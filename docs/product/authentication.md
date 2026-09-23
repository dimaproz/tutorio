# Authentication Workflow

Last verified: 2026-09-23 against the Studio sign-in and registration screens.

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

## Approved screen brief — Studio handoff

The F3 `login-03`/`signup-03` centred card was superseded by the approved
"Studio - Indigo & Sky" handoff (see `docs/current-state.md`). The workflow,
validation, and API behavior above are unchanged; only the composition moved.

### Composition

- Desktop (`lg` and up) is a 40 / 60 split: the form card on the left, a
  decorative promo panel on the right. Below `lg` the form card has the page
  alone.
- Phones show a compact tinted band above the form card with the logo, the
  EN / UA locale switch, and the same promo chip and headline.
- The promo panel, the phone band's chip and headline, and the collage of
  product cards are decoration. They are `aria-hidden`, contain nothing
  focusable, and never carry information or an action needed to sign in. The
  panel pins the light palette with `.surface-light` in both themes.
- The form card holds the logo and the locale switch on desktop, then the
  title, description, fields, the primary action, and the link to the other
  form.

### Sign-in hierarchy

1. Title and a concise workspace-oriented description.
2. Email field.
3. Password field with show/hide control.
4. Primary sign-in button.
5. Request error, when present, as an announced `Notice` directly under the
   primary action; entered values are kept.
6. Registration link.

### Registration hierarchy

Registration remains one page and one submission. Do not introduce a wizard or
stepper.

1. Title and concise description.
2. A labelled workspace-mode choice (`ChoiceCardGroup`): solo tutor or
   multi-teacher school.
3. Tutor name, and the workspace name beside it only when `SCHOOL` is
   selected (one column on phones, two from `sm`).
4. Email.
5. Password and confirmation, side by side from `sm`, stacked on phones.
6. Primary create-workspace button, with the request error under it.
7. Sign-in link.

### Component boundary

Compose `TextField`, `ChoiceCardGroup`, `Notice`, `Segmented` (through
`LocaleSegmented`), `Badge`, `Button`, and `Spinner`. The shell and the promo
collage are feature-owned (`features/auth/ui`). Keep API mutations and
navigation in thin runtime containers; keep the visual forms deterministic and
backend-independent so Storybook does not require a session, API server, or
global query provider.

## Responsive and accessibility contract

- Mobile uses normal document scrolling, safe page padding, full-width actions,
  and no horizontal overflow or clipped controls at 320px.
- Labels remain visible; placeholders do not replace them.
- Validation sets `aria-invalid` on the control, wires its hint and error with
  `aria-describedby`, and moves focus to the first invalid field.
- Request errors use an announced alert and retain entered values.
- Keyboard submission, password toggle operation, focus visibility, and focus
  order remain complete; the decorative promo adds no tab stops and nothing to
  the accessibility tree.
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
- Promotional content that carries information or an action needed to sign
  in; the promo panel stays decoration.
- Changes to authentication APIs, cookies, workspace-mode semantics, or session
  lifetime.
