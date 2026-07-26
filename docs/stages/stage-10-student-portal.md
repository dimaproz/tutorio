# Stage 10 — Student Portal (accounts, grades, progress)

> **Outcome:** the student (and parent) gets a real account with their profile,
> schedule, balance, grades, progress, and homework. The product becomes
> two-sided — a network effect and a moat, not just a tutor tool.
>
> **Pillar:** Student · **Status:** Vision (beyond MVP) · **Depends on:**
> Stage 6 (the progress/grades data to show), Stage 7 (the tokenized window it
> upgrades from), Stage 4 (balance/payments).
>
> This stage is the user's future vision and is deliberately at outline depth —
> it will be frozen only after Stages 6–7 land and we see real usage.

## 1. Product framing — three maturity levels

The portal is not one feature; it is a progression the earlier stages already
start:

1. **Window (Stage 7, read-only):** tokenized page — upcoming lessons, balance,
   payments, confirm/cancel. *Already planned.*
2. **Account (this stage):** real student/parent login. Personal profile,
   full history, grades and test results, lesson journal with homework and
   materials, attendance. Parent of a minor sees the child's payments + progress.
3. **Engagement (this stage+):** progress visualised over time, achievements /
   badges, goals, attendance streaks — soft gamification that motivates learning
   and reduces churn.

## 2. Goal & non-goals

**Goals**
- A **student/parent identity** distinct from the tutor's `User`/`WorkspaceMember`
  login (a portal account, minimal scopes, read-mostly).
- Read views over Stage 6 data (progress, tests, journal, attendance) and Stage 4
  data (balance, payments) — scoped strictly to the authenticated student (or a
  parent's linked children).
- Engagement layer: progress charts, achievements, goals.

**Non-goals**
- No student-authored content beyond confirm/cancel + maybe homework submission
  (decide when frozen).
- No messaging/chat (separate future bet).
- Not a public social surface — private to the workspace relationship.

## 3. Domain / model (indicative — freeze later)
- `StudentAccount` (or reuse `User` with a `student` scope) linking an auth
  identity to a `Student`; a parent identity may link to multiple students via
  the existing `StudentParent` relation.
- Achievements/goals as derived + lightweight stored entities
  (`Achievement`, `Goal`) — most progress visualisation derives from Stage 6
  data, so keep new tables minimal.
- Reuse `Student.publicToken` path for onboarding into a real account.

## 4. Architecture notes (senior)
- **Authorization is the whole game.** A student sees *only* their own rows; a
  parent sees only linked children. Enforce with a dedicated portal guard +
  row-level workspace+subject scoping — never reuse the tutor's broad workspace
  scope. Treat the portal API as a separate trust boundary (its own module,
  minimal endpoints, read-mostly).
- **Reuse, don't fork, the data layer.** Progress/finance reads come from the
  same services as the tutor side but through portal-scoped query methods; no
  duplicate business logic.
- **Mobile-first.** This surface is where a native app (Expo, out of MVP) would
  eventually attach — keep the portal API clean and client-agnostic.

## 5. API — `portal` module (separate trust boundary)
- Portal auth (student/parent), scoped guard.
- `GET /portal/me` — profile + linked children (parent).
- `GET /portal/schedule`, `/balance`, `/payments`, `/progress`, `/grades`,
  `/journal`, `/attendance` — all portal-scoped reads.
- `GET /portal/achievements`, `/goals` — engagement layer.
- Reuses Stage 7 confirm/cancel actions under the authenticated identity.

## 6. Web
A separate portal shell (not the tutor app shell), mobile-first, localised.
TailAdmin references: **profile page**, **progress charts / stat cards**,
**timeline** for the journal, **badges** for achievements. Keep it visually
distinct from the tutor app but on the same design system.

## 7. Sequencing (when frozen)
Portal identity + scoped guard (security first, with tests) → read views over
existing data → engagement layer (charts, achievements) → parent multi-child →
polish + i18n.

## 8. Testing
- **Security-first:** exhaustive authorization tests — a student cannot read
  another student; a parent only linked children; no workspace-wide leakage.
- Read-view correctness against seeded Stage 6/4 data.
- Web: portal shell renders on mobile; progress charts; achievements.

## 9. Definition of Done (when built)
Global DoD + : a student logs in and sees only their schedule, balance, grades,
and progress; a parent sees only their children; authorization is covered by a
dedicated test suite that is part of CI.

## 10. Risks & decisions
- **Authorization leakage is the top risk** — separate module/trust boundary,
  scoped guard, and a mandatory security-review before ship.
- **Scope explosion** — freeze the feature set only after Stages 6–7 usage; ship
  the Account level before the Engagement level.
- **Minor's data / GDPR** — parent access to a minor's data is a feature, but
  gate it behind the verified `StudentParent` link and the Stage 9 GDPR controls.
