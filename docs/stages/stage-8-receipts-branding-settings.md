# Stage 8 — Receipts, Branding, and Remaining Workspace Settings

> **Outcome:** a package/payment can be turned into a branded PDF receipt, and
> the workspace-level settings still missing locally (timezone, meeting link,
> receipt branding) are in place. Lower urgency than the CRM core, but every
> production settings tab depends on it.
>
> **Pillar:** Money · **Status:** Planned · **Depends on:** Stage 4 (the payment
> a receipt is issued for). Note: `timezone` may already have landed in Stage 5
> for reminders — this stage completes the settings surface around it.

## 1. Goal & non-goals

**Goals**
- `WorkspaceReceiptSettings` (1:1 with workspace): business info, recipient line,
  email, phone, taxId, address, primary/secondary color, invoice prefix, currency
  symbol, payment requisites, footer text — with a **live preview**.
- **PDF receipt generation** per package/payment (consumes the branding).
- Remaining workspace settings: `timezone` (if not from Stage 5), `meetingLink`
  (auto-attached to reminders).

**Non-goals**
- No accounting/tax integrations; the PDF is a receipt, not a legal invoice
  engine.

## 2. Domain / model
- `WorkspaceReceiptSettings` per mvp-plan schema.
- `Workspace.timezone`, `Workspace.meetingLink`.
- No new financial entities — the receipt reads existing `Payment`/`Package`.

## 3. API — receipts (thin module or inside `workspaces`)
- CRUD for `WorkspaceReceiptSettings` (owner-gated).
- `GET /packages/:id/receipt.pdf` , `GET /payments/:id/receipt.pdf` — server-side
  PDF render from a template + branding. Streamed download.

## 4. Web
TailAdmin reference: **settings tabs + form sections**, a **live-preview panel**
beside the branding form, **color inputs**. Add receipt-settings + workspace
(timezone, meeting link) tabs to
[settings](../../apps/web/src/components/settings/settings-view.tsx); "Download
receipt" on package/payment detail.

## 5. Sequencing
Settings model + form + live preview → PDF template + render endpoint → download
buttons → meeting-link wiring into reminders (closes the Stage 5 loop).

## 6. Testing
- API: settings CRUD owner-gated; PDF endpoint returns a valid PDF with branding
  applied; workspace scoping.
- Web: live preview reflects form; download works; owner-only visibility.

## 7. Definition of Done
Global DoD + : a package receipt downloads as a branded PDF matching the live
preview; reminders include the meeting link.

## 8. Risks & decisions
- **PDF rendering cost/security** — render server-side from trusted templates;
  sanitize user branding text; cap sizes.
- **Currency symbol vs code** — settings drive display only; stored money stays
  minor-unit integers.
