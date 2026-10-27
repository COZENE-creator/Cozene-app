-- Cozene — dev seed. Creates the default store the Phase-1 client already uses.
-- Apply after the migration:  psql "$DATABASE_URL" -f db/seed.sql
-- Idempotent: PGlite replays this on every boot.

INSERT INTO stores (slug, name, square_location_id, line_channel_ref)
VALUES ('store_001', 'Demo Store', NULL, NULL)
ON CONFLICT (slug) DO NOTHING;

-- ─── Cozene Base — Mini App pilot ─────────────────────────────────────────
-- Profile from the store's map listing and photos (web/miniapp/img/). Hours,
-- phone and the real menu are not set yet — the owner adds them in the Mother
-- System (Store / Menu pages); the menu items below are PLACEHOLDERS.
INSERT INTO stores (slug, name, tagline, concept, address, access, map_url,
                    hero_image_url, photos, theme_color)
VALUES (
  'cozene-base',
  'COZENE BASE',
  'Bistro · Wine · Cuisine · Good times',
  E'A neighbourhood bistro in Yutenji for wine, cuisine and good times.\nPull up a seat at the counter under warm wood and soft light.',
  '〒153-0052 東京都目黒区祐天寺2-11-9 KTMコーポ 1階',
  'Yutenji, Meguro — near Yutenji Station (Tokyu Toyoko Line)',
  'https://maps.app.goo.gl/SPUZx23rTjxnR7gv5',
  'img/counter.jpg',
  '["img/storefront.jpg", "img/sign.jpg"]',
  '#c25a1e'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO menu_categories (store_id, key, label, sort_order)
SELECT s.id, c.key, c.label, c.sort_order
  FROM stores s,
       (VALUES ('wine_glass', 'Wine by the glass', 1),
               ('food',       'Food',              2),
               ('dessert',    'Desserts',          3)) AS c(key, label, sort_order)
 WHERE s.slug = 'cozene-base'
ON CONFLICT (store_id, key) DO NOTHING;

-- Sample items only when the store has no menu yet, so owner edits survive reboots.
INSERT INTO menu_items (store_id, category_id, name, description, price, price_note, sort_order)
SELECT s.id, c.id, i.name, i.description, i.price, i.price_note, i.sort_order
  FROM stores s
  JOIN menu_categories c ON c.store_id = s.id
  JOIN (VALUES
         ('wine_glass', 'Sample orange wine',   'Placeholder item', 1200, 'Glass', 1),
         ('wine_glass', 'Sample sparkling',     'Placeholder item', 1300, 'Glass', 2),
         ('food',       'Sample seasonal plate','Placeholder item', 1400, NULL,    1),
         ('dessert',    'Sample dessert',       'Placeholder item',  800, NULL,    1)
       ) AS i(cat, name, description, price, price_note, sort_order) ON i.cat = c.key
 WHERE s.slug = 'cozene-base'
   AND NOT EXISTS (SELECT 1 FROM menu_items m WHERE m.store_id = s.id);

INSERT INTO benefits (store_id, key, title, description, rule)
SELECT s.id, 'first_visit_glass', 'One free glass of wine',
       'Welcome gift on your first visit. Show this screen to staff.', 'first_visit'
  FROM stores s WHERE s.slug = 'cozene-base'
ON CONFLICT (store_id, key) DO NOTHING;
