-- Cozene — dev seed. Creates the default store the Phase-1 client already uses.
-- Apply after the migration:  psql "$DATABASE_URL" -f db/seed.sql

INSERT INTO stores (slug, name, square_location_id, line_channel_ref)
VALUES ('store_001', 'Demo Store', NULL, NULL)
ON CONFLICT (slug) DO NOTHING;
