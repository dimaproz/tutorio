# Stage 7 — Public Student Page (token link)

> **Outcome:** the student gets a read-mostly window into their own schedule and
> balance without an account — a mobile page reachable by an unguessable token,
> where they can confirm or cancel a lesson within the deadline. Removes the
> tutor's phone-tag.
>
> **Pillar:** Student · **Status:** Planned · **Depends on:** Stage 3
> (lessons), Stage 4 (balance/payments to show). First maturity level of the
> student portal (Stage 10 turns this into real accounts).

## 1. Goal & non-goals

**Goals**
- A tokenized, no-login page: upcoming lessons, credit balance, payment history.
- Lesson **confirm / cancel** as separate signed actions, respecting the
  enrollment's cancellation deadline.
- Rate limiting on the public surface.

**Non-goals**
- No login, no editing profile, no grades/progress yet (Stage 10).
- No write access beyond confirm/cancel of the student's own lessons.

## 2. Domain / model
- `Student.publicToken` (already in schema — 32-byte unguessable, read-only
  link).
- Confirm/cancel are signed action tokens (short-lived, single-purpose), rate
  limited — not the same as the page token.
- Cancellation respects `Enrollment.effectiveCancellationDeadlineHours` and
  routes through the Stage 3 state machine + Stage 4 ledger (a late cancel
  charges, an on-time cancel does not).

## 3. Domain logic
Reuse the cancellation-policy function (deadline → charged/uncharged) already
central to Stages 3–4; the public action just calls the same transition path
with `cancelledBy=student`.

## 4. API — `public` module
- No `AccessTokenGuard`; a dedicated token guard resolves `publicToken` →
  workspace-scoped student, read-only.
- `GET /public/:token` — upcoming lessons + balance + payments (minimal, PII-lean
  payload; never leak other students).
- `POST /public/:token/lessons/:id/confirm` , `/cancel` — signed, rate-limited,
  deadline-aware.

## 5. Web
Standalone mobile-first route outside the app shell. TailAdmin reference: a clean
mobile card layout; keep it minimal. Localised (uk/en) by the student's locale.

## 6. Sequencing
Token guard + read endpoint → signed confirm/cancel actions + rate limit →
deadline wiring into the state machine → mobile page → i18n.

## 7. Testing
- API: token scoping (no cross-student leakage); rate limit; late vs on-time
  cancel produces the correct ledger effect; signed action can't be replayed.
- Web: mobile render; confirm/cancel happy + deadline-blocked paths.

## 8. Definition of Done
Global DoD + : opening a real token link shows only that student's data; an
on-time cancel is free, a late cancel charges — both visible in the tutor's
ledger.

## 9. Risks & decisions
- **Token leakage / enumeration** — 32-byte tokens, no listing endpoint, rate
  limiting, PII-lean payloads.
- **Replay of signed actions** — single-use, short TTL, server-verified.
- **Deadline correctness across timezones** — computed from the lesson's stored
  tz rule, shown in the student's own timezone.
