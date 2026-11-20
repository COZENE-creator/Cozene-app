-- Cozene — photos uploaded from the admin (e.g. a phone camera).
-- Idempotent: PGlite replays every migration on boot.
--
-- Kept in the database so they are included in the backups and need no extra
-- storage service. The admin shrinks each photo before upload (≤1600px JPEG,
-- typically 150–400 KB). Served publicly at /media/<id>, and the image_url
-- columns (recommendations, menu_items) store that path.
CREATE TABLE IF NOT EXISTS media (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     uuid NOT NULL REFERENCES stores(id),
  content_type text NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  bytes        bytea NOT NULL,
  size         integer NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS media_store_idx ON media (store_id, created_at);
