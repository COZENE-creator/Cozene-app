# Cozene Mother System (Phase 2)

Admin console + backend for Cozene. One Next.js app that:

- **Ingests** LINE check-ins (`/api/checkin`, a drop-in for the Phase-1 Apps Script),
  LINE follow/unfollow (`/api/webhooks/line`), Square orders/payments (`/api/webhooks/square`),
  and in-app orders (`/api/order`).
- **Manages** customers + tags and **sends LINE push** campaigns, recording per-recipient
  delivery results (`/api/push/send`).
- **Collects weekly-special ratings** — after paying, the guest gets a LIFF screen with the
  dish photo and Good / OK / Not good (`/api/specials/current`, `/api/specials/rate`).
  The result drives follow-up push: target guests *by how they rated*, and generate the
  message copy from the result (Compose → "By weekly special rating" → "Draft from result").

Data lives in **PostgreSQL** (`../db/migrations/0001_phase2.sql`).

## Architecture

```
LIFF client (web/)  ──POST /api/checkin──▶  ┌──────────────────────┐
                    ──POST /api/order────▶  │   Next.js (mother/)  │──▶ PostgreSQL
LINE OA  ──webhook──▶ /api/webhooks/line  │   API routes + admin │
Square   ──webhook──▶ /api/webhooks/square│   UI (React)         │──▶ LINE Messaging API (push)
Admin browser ─────▶ /customers /push ... └──────────────────────┘──▶ Square API (fetch/create)
```

Identity model: `users` is keyed on the push-capable LINE `userId` (the LIFF and Messaging API
channels are linked, so it is the same id). `user_identities` maps every source ref
(liff / square / …) to a user so refs without a LINE id (e.g. a Square customer) link later.
See `../db/migrations/0001_phase2.sql` for the full schema.

## Setup

```bash
cd mother
npm install
cp .env.example .env.local          # fill in DB + LINE + Square + admin values

# create the schema + default store
npm run db:migrate                    # psql "$DATABASE_URL" -f ../db/migrations/0001_phase2.sql
npm run db:seed                       # inserts the store with slug 'store_001'

npm run dev                           # http://localhost:3000
```

Point the LIFF client at this app: in `../web/config.js` set
`ENDPOINT_URL = <host>/api/checkin` and `ORDER_URL = <host>/api/order`. The rating screen
(`../web/rate.html`) derives its endpoints from `ENDPOINT_BASE`, or set
`SPECIAL_CURRENT_URL` / `SPECIAL_RATE_URL` explicitly.

## Environment variables

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `PGSSL` | set to `require` for managed Postgres needing TLS |
| `LINE_CHANNEL_ACCESS_TOKEN` | Messaging API push (server-only) |
| `LINE_CHANNEL_SECRET` | verify `X-Line-Signature` on the webhook |
| `SQUARE_ACCESS_TOKEN` | fetch orders/payments, create orders |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | verify Square webhook signature |
| `SQUARE_WEBHOOK_URL` | exact public webhook URL (part of the signed payload) |
| `SQUARE_ENVIRONMENT` | `sandbox` or `production` |
| `ADMIN_EMAILS`, `ADMIN_PASSWORD` | admin login allowlist + shared password |
| `ADMIN_SESSION_SECRET` | signs the session cookie |
| `DEFAULT_STORE_SLUG` | store used for single-store webhook/push resolution |

## Register the webhooks

- **LINE**: Messaging API channel → Webhook URL = `<host>/api/webhooks/line`, enable "Use webhook".
- **Square**: Developer Dashboard → Webhooks → subscribe `order.created`, `order.updated`,
  `payment.created`, `payment.updated`; Notification URL = `<host>/api/webhooks/square`
  (must equal `SQUARE_WEBHOOK_URL`).

## Verification (per milestone)

- **M1** – `POST /api/checkin` with a `text/plain` JSON body → one new `visits` row +
  `{ok, visit_id, checked_in_at}`. (Scanning the Phase-1 QR does this end-to-end.)
- **M2** – add/remove the OA as a friend → a `users` row toggles `is_friend`; replaying the
  same webhook does not duplicate (dedup via `webhook_events`).
- **M3** – Compose → send to "All friends" → LINE push arrives, a `push_deliveries` row per
  recipient shows `sent`/`failed` with the LINE request id on `/push/[id]`.
- **M4** – Square sandbox order + payment → `orders`/`order_items`/`payments` upsert; replays
  are idempotent.
- **M5** – place an in-app order (`web/order.html`) → Square order created with `reference_id`,
  the webhook auto-links `orders.user_id`; assign a tag and send a "By tag" campaign.

Guards verified without a DB (routing, CORS, LINE/Square signature checks, admin auth): all pass.
The DB-backed flows above require a running Postgres.

## Build order / status

M1–M5 are implemented (see the repo plan). Deferred to Phase 3+: scheduled sends (the
`scheduled_at` column exists; no cron worker yet), Claude auto-tagging (`user_tags.source`
+ `confidence` already present), content-match delivery, and a segment-rule builder
(audience is `all` / `tag` today).
