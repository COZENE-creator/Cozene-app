-- Cozene Phase 2 — production schema.
-- Captures behavior across LINE (visits), in-app orders, and Square (payments),
-- plus the Mother System push campaigns + per-recipient delivery results.
--
-- Conventions:
--   * uuid PKs via gen_random_uuid() (pgcrypto)
--   * timestamptz everywhere
--   * store_id FK on every business table (store-agnostic / multi-store)
--   * jsonb `raw` columns keep the untouched source payload for debugging
--   * unique constraints on external ids make every ingest an idempotent upsert
--
-- Apply:  psql "$DATABASE_URL" -f db/migrations/0001_phase2.sql

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── stores ───────────────────────────────────────────────────────────────
-- One deployment serves many venues. `slug` maps the Phase-1 store_id string.
CREATE TABLE IF NOT EXISTS stores (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               text UNIQUE NOT NULL,
  name               text NOT NULL,
  square_location_id text,
  line_channel_ref   text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- ─── users ────────────────────────────────────────────────────────────────
-- Push-capable identity, keyed on the (channel-linked) LINE userId.
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      uuid NOT NULL REFERENCES stores(id),
  line_user_id  text,                       -- from LIFF (linked scope) and/or follow webhook
  display_name  text,
  is_friend     boolean NOT NULL DEFAULT false,
  followed_at   timestamptz,
  unfollowed_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, line_user_id)
);
CREATE INDEX IF NOT EXISTS idx_users_store_friend ON users(store_id, is_friend);

-- ─── user_identities ──────────────────────────────────────────────────────
-- Resolve liff / miniapp / messaging / square refs to a single user.
-- user_id NULL = not yet linked (e.g. a Square customer with no LINE id).
CREATE TABLE IF NOT EXISTS user_identities (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     uuid NOT NULL REFERENCES stores(id),
  user_id      uuid REFERENCES users(id),
  id_source    text NOT NULL,               -- 'liff' | 'miniapp' | 'messaging' | 'square'
  external_ref text NOT NULL,
  linked_at    timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, id_source, external_ref)
);
CREATE INDEX IF NOT EXISTS idx_identities_user ON user_identities(user_id);

-- ─── visits (Phase-1 compatible) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS visits (
  visit_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      uuid NOT NULL REFERENCES stores(id),
  user_ref      text NOT NULL,
  id_source     text NOT NULL DEFAULT 'liff',
  user_id       uuid REFERENCES users(id),
  checked_in_at timestamptz NOT NULL,
  raw_payload   jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_visits_store_time ON visits(store_id, checked_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_visits_user ON visits(user_id);

-- ─── orders (in-app + Square) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id           uuid NOT NULL REFERENCES stores(id),
  user_id            uuid REFERENCES users(id),
  square_order_id    text,
  square_location_id text,
  reference_id       text,                  -- LINE id set on CreateOrder → auto-link key
  state              text,                  -- OPEN | COMPLETED | CANCELED
  total_amount       bigint,                -- minor units
  currency           text DEFAULT 'JPY',
  source             text NOT NULL DEFAULT 'square', -- 'inapp' | 'square'
  ordered_at         timestamptz,
  closed_at          timestamptz,
  raw                jsonb NOT NULL DEFAULT '{}',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, square_order_id)
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_store_time ON orders(store_id, ordered_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  store_id     uuid NOT NULL REFERENCES stores(id),
  square_uid   text,
  name         text,
  quantity     numeric,
  unit_amount  bigint,
  total_amount bigint,
  category     text,
  raw          jsonb NOT NULL DEFAULT '{}',
  UNIQUE (order_id, square_uid)
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS payments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id          uuid NOT NULL REFERENCES stores(id),
  order_id          uuid REFERENCES orders(id),
  user_id           uuid REFERENCES users(id),
  square_payment_id text NOT NULL,
  square_order_id   text,
  amount            bigint,
  currency          text DEFAULT 'JPY',
  status            text,                   -- APPROVED | COMPLETED | FAILED
  paid_at           timestamptz,
  raw               jsonb NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, square_payment_id)
);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

-- ─── tags + user_tags (Phase-3 groundwork) ────────────────────────────────
CREATE TABLE IF NOT EXISTS tags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    uuid NOT NULL REFERENCES stores(id),
  key         text NOT NULL,
  label       text NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, key)
);

CREATE TABLE IF NOT EXISTS user_tags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    uuid NOT NULL REFERENCES stores(id),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag_id      uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  source      text NOT NULL DEFAULT 'manual', -- 'manual' | 'claude'
  confidence  numeric,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_user_tags_tag ON user_tags(tag_id);

-- ─── push campaigns + per-recipient delivery results ──────────────────────
CREATE TABLE IF NOT EXISTS push_campaigns (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      uuid NOT NULL REFERENCES stores(id),
  title         text NOT NULL,
  body          text NOT NULL,
  audience_type text NOT NULL,              -- 'all' | 'tag' | 'segment'
  audience_spec jsonb NOT NULL DEFAULT '{}',
  status        text NOT NULL DEFAULT 'draft', -- draft|scheduled|sending|sent|failed
  scheduled_at  timestamptz,                -- NULL = send now
  created_by    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  sent_at       timestamptz
);
CREATE INDEX IF NOT EXISTS idx_campaigns_store ON push_campaigns(store_id, created_at DESC);

CREATE TABLE IF NOT EXISTS push_deliveries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     uuid NOT NULL REFERENCES push_campaigns(id) ON DELETE CASCADE,
  store_id        uuid NOT NULL REFERENCES stores(id),
  user_id         uuid NOT NULL REFERENCES users(id),
  line_user_id    text NOT NULL,
  status          text NOT NULL DEFAULT 'pending', -- pending | sent | failed
  line_request_id text,                     -- LINE X-Line-Request-Id header
  error_code      text,
  error_message   text,
  sent_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_deliveries_campaign ON push_deliveries(campaign_id, status);

-- ─── raw webhook log (idempotency + debug) ────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source       text NOT NULL,              -- 'line' | 'square'
  event_type   text,
  external_id  text,
  store_id     uuid REFERENCES stores(id),
  signature_ok boolean,
  payload      jsonb NOT NULL,
  processed_at timestamptz,
  received_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);
CREATE INDEX IF NOT EXISTS idx_webhook_unprocessed ON webhook_events(source, processed_at);

COMMIT;
