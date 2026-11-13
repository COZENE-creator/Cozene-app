-- Cozene — weekly special menu + guest ratings.
--
-- The store serves one special menu per week. After paying, the guest is shown
-- a LIFF screen with the dish photo and three buttons (Good / OK / Not good).
-- The collected ratings drive push: who to send to (rated good → "it's back",
-- rated bad → recovery offer) and what to say (aggregate result copy).
--
-- Same conventions as 0001: uuid PKs, timestamptz, store_id on every table,
-- unique constraints that make writes idempotent upserts.
--
-- Apply:  psql "$DATABASE_URL" -f db/migrations/0002_specials.sql

-- ─── the weekly special itself ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS specials (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    uuid NOT NULL REFERENCES stores(id),
  week_start  date NOT NULL,                    -- Monday of the week it runs
  title       text NOT NULL,
  description text,
  image_url   text,                             -- dish photo shown to the guest
  status      text NOT NULL DEFAULT 'active',   -- draft | active | archived
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  -- one special per store per week: re-saving the same week updates in place
  UNIQUE (store_id, week_start)
);
CREATE INDEX IF NOT EXISTS idx_specials_store_week ON specials(store_id, week_start DESC);

-- ─── one rating per guest per special ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS special_ratings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id   uuid NOT NULL REFERENCES stores(id),
  special_id uuid NOT NULL REFERENCES specials(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
  user_ref   text NOT NULL,                     -- LIFF userId as sent by the client
  rating     text NOT NULL CHECK (rating IN ('good', 'ok', 'bad')),
  comment    text,                              -- optional free text, unused in MVP UI
  order_id   uuid REFERENCES orders(id),        -- the paid order that triggered the prompt
  source     text NOT NULL DEFAULT 'liff',      -- liff | miniapp | admin
  rated_at   timestamptz NOT NULL DEFAULT now(),
  -- a guest can change their mind; the upsert overwrites rather than duplicates
  UNIQUE (special_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_special_ratings_special ON special_ratings(special_id);
CREATE INDEX IF NOT EXISTS idx_special_ratings_user ON special_ratings(user_id);
