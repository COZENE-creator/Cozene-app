-- Cozene — 本日のおすすめ (today's recommendation) and table reservations.
-- Idempotent: PGlite replays every migration on boot.

-- ─── today's recommendation ─────────────────────────────────────────────────
-- Free-form dishes the staff write (often off-menu, e.g. 本日の魚料理), shown at
-- the top of the Mini App menu. Text columns are Japanese; English is in
-- `translations` like the menu ({"en": {"title", "description", "price_note"}}).
CREATE TABLE IF NOT EXISTS recommendations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     uuid NOT NULL REFERENCES stores(id),
  title        text NOT NULL,
  description  text,
  price        bigint,                         -- whole yen; NULL = ask staff
  price_note   text,
  image_url    text,
  translations jsonb NOT NULL DEFAULT '{}'::jsonb,
  show_date    date,                           -- shown only on this date (Japan time); NULL = until removed
  sort_order   int  NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recommendations_store ON recommendations(store_id, show_date);

-- ─── reservations ───────────────────────────────────────────────────────────
-- A guest's request from the Mini App 予約 tab; staff confirm or decline it in
-- Mother and the guest gets a LINE message in the language they booked in.
CREATE TABLE IF NOT EXISTS reservations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      uuid NOT NULL REFERENCES stores(id),
  guest_id      uuid NOT NULL REFERENCES guests(id),
  user_id       uuid REFERENCES users(id),
  reserved_for  timestamptz NOT NULL,
  party_size    int  NOT NULL CHECK (party_size BETWEEN 1 AND 30),
  name          text NOT NULL,
  phone         text,
  note          text,
  lang          text NOT NULL DEFAULT 'ja',      -- language of the guest's messages
  status        text NOT NULL DEFAULT 'requested'
                CHECK (status IN ('requested', 'confirmed', 'declined', 'cancelled')),
  staff_message text,                            -- optional line added to the LINE reply
  decided_at    timestamptz,
  notified      boolean,                         -- LINE reply delivered? NULL = not sent yet
  notify_error  text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reservations_store_time ON reservations(store_id, reserved_for);
CREATE INDEX IF NOT EXISTS idx_reservations_guest ON reservations(guest_id, reserved_for);

-- Booking hours per store: {"enabled": true, "from": "17:00", "to": "21:30",
-- "step": 30, "max_party": 8, "days_ahead": 60}. Missing keys use the defaults
-- in mother/src/lib/reservations.ts.
ALTER TABLE stores ADD COLUMN IF NOT EXISTS reservation_settings jsonb NOT NULL DEFAULT '{}'::jsonb;
