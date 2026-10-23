-- Cozene — dev seed. Creates the default store the Phase-1 client already uses.
-- Apply after the migration:  psql "$DATABASE_URL" -f db/seed.sql
-- Idempotent: PGlite replays this on every boot.

INSERT INTO stores (slug, name, square_location_id, line_channel_ref)
VALUES ('store_001', 'Demo Store', NULL, NULL)
ON CONFLICT (slug) DO NOTHING;

-- ─── Cozene Base — Mini App pilot ─────────────────────────────────────────
-- Profile text and menu below are PLACEHOLDERS so the Mini App renders; the
-- owner replaces them in the Mother System (Store / Menu pages).
INSERT INTO stores (slug, name, tagline, concept, hours, access, theme_color)
VALUES (
  'cozene-base',
  'Cozene Base',
  'Natural wine & small plates',
  'Placeholder concept — edit in Mother System → Store.',
  E'Tue–Sat 17:00–24:00\nSun 15:00–22:00\nClosed Mondays',
  'Placeholder access — edit in Mother System → Store.',
  '#7a1f3d'
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
