-- Cozene — multi-language Mini App content.
--
-- The regular columns hold the store's default language (Japanese). Other
-- languages live in `translations`, keyed by language code, with the same field
-- names as the columns they translate:
--
--   stores.translations          {"en": {"tagline": …, "concept": …, "hours": …, "access": …, "address": …}}
--   menu_categories.translations {"en": {"label": …}}
--   menu_items.translations      {"en": {"name": …, "description": …, "price_note": …}}
--   benefits.translations        {"en": {"title": …, "description": …}}
--
-- A missing field falls back to the default-language column.
-- Idempotent: PGlite replays every migration on boot.

ALTER TABLE stores          ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE menu_items      ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE benefits        ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;
