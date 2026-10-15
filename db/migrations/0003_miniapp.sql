-- Cozene — LINE Mini App (Cozene Base pilot, reusable for every partner store).
--
-- One Cozene Mini App serves all stores; the store (and table) come from the QR
-- URL. Because every store sits under one LINE provider, the Mini App userId is
-- the same guest at every store — `guests` is that cross-store person, and the
-- existing per-store `users` rows point at it.
--
-- Adds:
--   * store profile + branding + staff PIN (columns on `stores`)
--   * menu_categories / menu_items           — public menu, per store
--   * guests (+ users.guest_id)              — one person across stores
--   * consents                               — append-only consent history
--   * visits.table_no / visits.party_size    — table QR check-in
--   * benefits / benefit_redemptions         — first-visit free glass, once per guest
--
-- Same conventions as 0001. Re-runnable (PGlite replays every migration on boot).
--
-- Apply:  psql "$DATABASE_URL" -f db/migrations/0003_miniapp.sql

-- ─── store profile (public "store introduction" page) ──────────────────────
ALTER TABLE stores ADD COLUMN IF NOT EXISTS tagline        text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS concept        text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS hours          text;   -- free text, one line per row
ALTER TABLE stores ADD COLUMN IF NOT EXISTS address        text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS access         text;   -- "3 min from X station"
ALTER TABLE stores ADD COLUMN IF NOT EXISTS phone          text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS map_url        text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS hero_image_url text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS photos         jsonb NOT NULL DEFAULT '[]'; -- ["https://…"]
ALTER TABLE stores ADD COLUMN IF NOT EXISTS theme_color    text;   -- per-store brand accent, "#7a1f3d"
ALTER TABLE stores ADD COLUMN IF NOT EXISTS staff_pin_hash text;   -- scrypt; staff confirm benefits with it
ALTER TABLE stores ADD COLUMN IF NOT EXISTS updated_at     timestamptz NOT NULL DEFAULT now();

-- ─── menu ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu_categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id   uuid NOT NULL REFERENCES stores(id),
  key        text NOT NULL,                    -- wine_glass | food | dessert | …
  label      text NOT NULL,
  sort_order int  NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, key)
);

CREATE TABLE IF NOT EXISTS menu_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     uuid NOT NULL REFERENCES stores(id),
  category_id  uuid NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
  name         text NOT NULL,
  description  text,
  price        bigint,                         -- minor units (whole yen); NULL = "ask staff"
  price_note   text,                           -- "Glass 90ml", "Market price"
  image_url    text,
  sort_order   int  NOT NULL DEFAULT 0,
  is_available boolean NOT NULL DEFAULT true,  -- false = hidden from guests (sold out / off-season)
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id, sort_order);

-- ─── guests: one person across every Cozene store ──────────────────────────
CREATE TABLE IF NOT EXISTS guests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id text UNIQUE NOT NULL,           -- provider-scoped, so identical at every store
  display_name text,
  picture_url  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS guest_id uuid REFERENCES guests(id);
CREATE INDEX IF NOT EXISTS idx_users_guest ON users(guest_id);

-- Backfill: every existing LINE-identified user gets a guest (idempotent).
INSERT INTO guests (line_user_id, display_name)
SELECT DISTINCT ON (line_user_id) line_user_id, display_name
  FROM users
 WHERE line_user_id IS NOT NULL
 ORDER BY line_user_id, updated_at DESC
ON CONFLICT (line_user_id) DO NOTHING;

UPDATE users u SET guest_id = g.id
  FROM guests g
 WHERE u.guest_id IS NULL AND g.line_user_id = u.line_user_id;

-- ─── consents: append-only, the latest row per (guest, store, scope) wins ──
-- store_use       — this store may use visit/order data to personalise messages (required)
-- partner_sharing — data may be shared with Cozene partner stores (optional)
CREATE TABLE IF NOT EXISTS consents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id       uuid NOT NULL REFERENCES guests(id),
  store_id       uuid NOT NULL REFERENCES stores(id),
  scope          text NOT NULL CHECK (scope IN ('store_use', 'partner_sharing')),
  granted        boolean NOT NULL,
  policy_version text NOT NULL,                -- which wording the guest agreed to
  source         text NOT NULL DEFAULT 'miniapp',
  decided_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_consents_lookup ON consents(guest_id, store_id, scope, decided_at DESC);

-- ─── table QR check-in ─────────────────────────────────────────────────────
ALTER TABLE visits ADD COLUMN IF NOT EXISTS table_no   text;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS party_size int;

-- ─── benefits (first-visit free glass, …) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS benefits (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    uuid NOT NULL REFERENCES stores(id),
  key         text NOT NULL,                   -- first_visit_glass
  title       text NOT NULL,                   -- "One free glass of wine"
  description text,
  rule        text NOT NULL DEFAULT 'first_visit', -- first_visit (only rule so far)
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, key)
);

-- Once per guest: the unique key makes a double-tap / two phones a no-op.
CREATE TABLE IF NOT EXISTS benefit_redemptions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  benefit_id   uuid NOT NULL REFERENCES benefits(id),
  store_id     uuid NOT NULL REFERENCES stores(id),
  guest_id     uuid NOT NULL REFERENCES guests(id),
  user_id      uuid REFERENCES users(id),
  visit_id     uuid REFERENCES visits(visit_id),
  confirmed_by text NOT NULL DEFAULT 'staff_pin',
  redeemed_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (benefit_id, guest_id)
);
CREATE INDEX IF NOT EXISTS idx_redemptions_store_time ON benefit_redemptions(store_id, redeemed_at DESC);
