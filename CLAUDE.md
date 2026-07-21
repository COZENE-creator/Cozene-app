# Cozene — Project Instructions

Source of truth: `COZENE MVP PHASE1 のコピー のコピー.docx`. This file summarizes it for development. When the doc and this file disagree, the doc wins — update this file to match.

## Vision

Bring e-commerce-style marketing automation (behavioral data → personalized re-engagement) into physical restaurants using **LINE**. The system accumulates visit, order, and payment data, auto-tags customers with the **Claude API**, and delivers LINE messages at the optimal timing and content.

**Full data flow (end state):**
- **Collect** (LINE Mini App): QR check-in → *who visited*; in-app ordering → *what was ordered*; Square integration → *how much paid*. Records land in a spreadsheet-based DB.
- **Tag**: Set desired tags in the "Mother System" → Claude API reads the DB and assigns tags to LINE IDs.
- **Deliver**: Trigger delivery (rule-based) + content-match delivery (Claude analyzes store-uploaded content and matches it to tagged customers).

**Design premise: the system must be store-agnostic.** Develop it independently of any specific venue. Target production DB: **PostgreSQL** (Phase 1 uses Google Sheets).

## Phases

| Phase | Description | What is achieved |
|---|---|---|
| 1 | QR check-in → visit log → DB entry | "Who visited" |
| 2 | Ordering + Square integration → order-level DB | "What was ordered & how much paid" |
| 3 | Mother System + Claude API tagging + trigger delivery | "Auto-tag and deliver" |
| 4 | Store content analysis → tag matching → content-match delivery | "Deliver to the right audience by content" |

Build incrementally. **Do not build everything at once.**

---

## Status: Phase 2 in progress (Mother System + Square + push)

Phase 1 is complete (LIFF check-in → `visit_logs`). Phase 2 (+ the Phase-3 Mother System
management screen, brought forward) is implemented in `mother/` (Next.js) on **PostgreSQL**:

- **DB**: `db/migrations/0001_phase2.sql` — `stores`, `users` (push-capable LINE id),
  `user_identities`, `visits`, `orders`/`order_items`/`payments` (Square), `tags`/`user_tags`,
  `push_campaigns`/`push_deliveries`, `webhook_events`. Google Sheets is being retired.
- **Mother System** (`mother/`): admin console (customers, campaigns, compose, tags) +
  API routes: `/api/checkin` (drop-in for the Apps Script `doPost`), `/api/order`,
  `/api/webhooks/line`, `/api/webhooks/square`, `/api/push/send`. See `mother/README.md`.
- **Confirmed for this build**: PostgreSQL now; Next.js; Messaging API + OA exist and the
  LIFF login channel and Messaging API channel are **linked** (so the LIFF `userId` is
  push-capable); Square sandbox; in-app ordering UI included (`web/order.html`).
- **Deferred to Phase 3+**: scheduled sends (column exists, no cron worker), Claude
  auto-tagging (`user_tags.source`/`confidence` ready), content-match delivery, segment rules.

Full design: `~/.claude/plans/groovy-forging-peach.md`.

---

## Current Focus: Phase 1 (Week 1)

**Definition of Done:** Scanning a QR code adds one row to a spreadsheet containing the LINE user ID and the visit timestamp — demonstrated in a development environment.

Phase 1 proves the entry point (`QR check-in → visit log → DB`). Customer-ID acquisition is the foundation everything else builds on.

### In scope
- LINE Developers setup (LIFF channel creation)
- QR code generation (embedding the check-in URL)
- Minimal LIFF app: access via QR → retrieve LINE `userId` → send visit log
- Write to Google Sheets (one row per visit)
- Finalize the visit-log schema (below)

### Out of scope (do not touch this week)
- LINE Mini App application/review process
- Ordering feature and Square integration (Phase 2)
- Mother System, Claude API tagging, delivery (Phases 3–4)
- Production-quality UI/design polish
- Comprehensive error handling / exception processing
- Authentication and security hardening (minimal is fine at PoC stage)
- Multi-store simultaneous operation

> The goal is for it to work. Refinement comes later. **When in doubt, choose the minimal implementation.**

---

## Technical Guidelines

- **Use LIFF, not Mini App.** Sufficient for a single-store MVP and avoids the 2–4 week review wait. The LIFF `userId` is channel-scoped, which is fine for one store. Migrate to Mini App later when cross-store support is needed.
- **Write destination: Google Sheets.** Either an Apps Script Web App (`doPost`) or the Sheets API directly — choose whichever is lighter.
- **Frontend: minimal** (HTML/JS or a lightweight framework). Use whatever setup the developer is comfortable with.

## Data Schema — `visit_logs` (one sheet)

The ID field is abstracted so we can migrate to Mini App by swapping only `user_ref`.

| Column | Type | Description |
|---|---|---|
| `visit_id` | string (UUID) | Unique key for the visit log |
| `store_id` | string | Required even for one store — for future multi-store support |
| `user_ref` | string | User identifier. Currently the LIFF `userId`; replaced with Mini App `userId` on migration |
| `id_source` | string | `liff` or `miniapp`. Distinguishes records during migration |
| `checked_in_at` | string (ISO 8601) | Check-in timestamp |
| `raw_payload` | string (JSON) | Raw data for debugging |

## Task Breakdown (~10 hours est.)

1. LINE Developers setup (create provider / LIFF channel, obtain LIFF ID)
2. QR code generation (embed the check-in URL)
3. Minimal LIFF app implementation (access via QR → retrieve `userId`)
4. Google Sheets write (Apps Script Web App or Sheets API)
5. Finalize schema + verify one row is added correctly
6. Brief handoff notes (system config, pain points, notes for next week)

## Open Questions (confirm before/while building)

- Which Google Workspace / Sheets account hosts this?
- Who owns the LINE Developers account, and how is it registered?
- Preferred frontend setup, if any?

## Outlook (for reference — not fixed)

- **Week 2:** visit-log cleanup & dedup, repeat-visit recording, basic visit-frequency aggregation.
- **Week 3+:** initial weekly owner-report template, initial churn-scoring logic.

Scope beyond Week 1 is finalized after reviewing Week 1 results.
