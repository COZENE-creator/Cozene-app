-- Cozene — dev seed. Creates the default store the Phase-1 client already uses.
-- Apply after the migration:  psql "$DATABASE_URL" -f db/seed.sql
-- Idempotent: PGlite replays this on every boot.

INSERT INTO stores (slug, name, square_location_id, line_channel_ref)
VALUES ('store_001', 'Demo Store', NULL, NULL)
ON CONFLICT (slug) DO NOTHING;

-- ─── Cozene Base — Mini App pilot ─────────────────────────────────────────
-- Profile from the store's map listing and photos (web/miniapp/img/). Hours and
-- phone are not set yet — the owner adds them in the Mother System (Store page).
-- Menu from COZENE_BASE_menu_A4_両面.pdf; prices are tax-included yen.
--
-- Japanese is the default language (the regular columns); English lives in
-- `translations` (db/migrations/0004_i18n.sql). Each "translate" UPDATE below only
-- touches rows that have no translations yet, so it upgrades databases seeded
-- before i18n and never overwrites the owner's own edits.
INSERT INTO stores (slug, name, tagline, concept, address, access, map_url,
                    hero_image_url, photos, theme_color)
VALUES (
  'cozene-base',
  'COZENE BASE',
  'ワイン・料理・楽しいひととき',
  E'祐天寺の街角にある、ワインと料理と楽しいひとときのためのビストロ。\n温かな木の天井とやわらかな灯りのカウンターで、ゆっくりお過ごしください。',
  '〒153-0052 東京都目黒区祐天寺2-11-9 KTMコーポ 1階',
  '東急東横線「祐天寺駅」近く（目黒区祐天寺）',
  'https://maps.app.goo.gl/SPUZx23rTjxnR7gv5',
  'img/counter.jpg',
  '["img/entrance.jpg", "img/interior.jpg", "img/sign-night.jpg", "img/sign.jpg"]',
  '#c25a1e'
)
ON CONFLICT (slug) DO NOTHING;

UPDATE stores
   SET tagline = 'ワイン・料理・楽しいひととき',
       concept = E'祐天寺の街角にある、ワインと料理と楽しいひとときのためのビストロ。\n温かな木の天井とやわらかな灯りのカウンターで、ゆっくりお過ごしください。',
       access  = '東急東横線「祐天寺駅」近く（目黒区祐天寺）',
       translations = '{"en": {"tagline": "Bistro · Wine · Cuisine · Good times", "concept": "A neighbourhood bistro in Yutenji for wine, cuisine and good times.\nPull up a seat at the counter under warm wood and soft light.", "access": "Yutenji, Meguro — near Yutenji Station (Tokyu Toyoko Line)", "address": "KTM Corpo 1F, 2-11-9 Yutenji, Meguro-ku, Tokyo 153-0052"}}'::jsonb
 WHERE slug = 'cozene-base' AND translations = '{}'::jsonb;

INSERT INTO menu_categories (store_id, key, label, sort_order)
SELECT s.id, c.key, c.label, c.sort_order
  FROM stores s,
       (VALUES
               ('entrees', '前菜', 1),
               ('plats', 'メイン', 2),
               ('pates_risotto', 'パスタ・リゾット', 3),
               ('desserts', 'デセール', 4),
               ('sparkling', 'グラスワイン 泡', 5),
               ('white', 'グラスワイン 白', 6),
               ('red', 'グラスワイン 赤', 7),
               ('bottles', 'ボトルワイン', 8),
               ('highball', 'ハイボール', 9)
       ) AS c(key, label, sort_order)
 WHERE s.slug = 'cozene-base'
ON CONFLICT (store_id, key) DO NOTHING;

UPDATE menu_categories c
   SET label = v.label, translations = v.tr
  FROM stores s,
       (VALUES
         ('entrees', '前菜', '{"en": {"label": "Entrées"}}'::jsonb),
         ('plats', 'メイン', '{"en": {"label": "Mains"}}'::jsonb),
         ('pates_risotto', 'パスタ・リゾット', '{"en": {"label": "Pasta & Risotto"}}'::jsonb),
         ('desserts', 'デセール', '{"en": {"label": "Desserts"}}'::jsonb),
         ('sparkling', 'グラスワイン 泡', '{"en": {"label": "Sparkling wine by the glass"}}'::jsonb),
         ('white', 'グラスワイン 白', '{"en": {"label": "White wine by the glass"}}'::jsonb),
         ('red', 'グラスワイン 赤', '{"en": {"label": "Red wine by the glass"}}'::jsonb),
         ('bottles', 'ボトルワイン', '{"en": {"label": "Bottles"}}'::jsonb),
         ('highball', 'ハイボール', '{"en": {"label": "Highballs"}}'::jsonb)
       ) AS v(key, label, tr)
 WHERE s.slug = 'cozene-base' AND c.store_id = s.id AND c.key = v.key
   AND c.translations = '{}'::jsonb;

-- Menu items only when the store has no menu yet, so owner edits survive reboots.
INSERT INTO menu_items (store_id, category_id, name, description, price, price_note, sort_order)
SELECT s.id, c.id, i.name, i.description, i.price, i.price_note, i.sort_order
  FROM stores s
  JOIN menu_categories c ON c.store_id = s.id
  JOIN (VALUES
         ('entrees', '越後もち豚のパテ・ド・カンパーニュ', 'Pâté de campagne de porc Mochi d’Echigo', 1760, NULL, 1),
         ('entrees', 'フランス産栗のポタージュ', 'Velouté de châtaignes françaises', 990, NULL, 2),
         ('entrees', 'レバームース', 'Mousse de foie', 990, NULL, 3),
         ('entrees', '仔羊のリエット', 'Rillettes d’agneau', 880, NULL, 4),
         ('entrees', '燻製ウフマヨ', 'Œuf mayonnaise fumé', 1078, NULL, 5),
         ('entrees', 'フレンチフライ', 'Pommes frites', 990, NULL, 6),
         ('entrees', 'ジャンボンブラン', 'Jambon blanc', 1320, NULL, 7),
         ('entrees', '燻製鴨ハムとレンズ豆のサラダ', 'Salade de lentilles au canard fumé', 2530, NULL, 8),
         ('entrees', 'フランス産生ハムとサラミの盛り合わせ', 'Assiette de jambon cru et saucisson français', 1980, NULL, 9),
         ('entrees', 'オニオングラタンスープ', 'Soupe à l’oignon gratinée', 880, NULL, 10),
         ('entrees', 'スモークサーモン', 'Saumon fumé', 2090, NULL, 11),
         ('plats', '鴨もも肉のコンフィ', 'Confit de cuisse de canard', 3080, NULL, 1),
         ('plats', '蝦夷鹿のロースト', 'Rôti de cerf d’Ezo', 2750, NULL, 2),
         ('plats', '国産牛ロースト', 'Bœuf rôti japonais', 5280, NULL, 3),
         ('plats', '豪州産仔羊のロースト', 'Agneau rôti d’Australie', 4950, NULL, 4),
         ('plats', '本日の魚料理', 'Poisson du jour', 3300, NULL, 5),
         ('plats', 'ブフ・ブルギニョン', 'Bœuf bourguignon', 4950, NULL, 6),
         ('pates_risotto', '蝦夷鹿のボロネーゼ リガトーニ', 'Rigatoni à la bolognaise de cerf d’Ezo', 1980, NULL, 1),
         ('pates_risotto', 'コンテとキノコのリゾット', 'Risotto au comté et aux champignons', 2200, NULL, 2),
         ('desserts', 'バニラアイスとキャラメルアイス盛り合わせ', 'Assortiment de glaces vanille et caramel', 990, NULL, 1),
         ('desserts', 'タルトショコラ', 'Tarte au chocolat', 1320, NULL, 2),
         ('sparkling', 'プティ・コトー ヴヴレー MT キュヴェ・レ・テュフィエール ブリュット 2022', 'フランス', 1320, 'グラス', 1),
         ('sparkling', 'ロータリ ブリュット プラチナ 2021', 'イタリア', 1430, 'グラス', 2),
         ('sparkling', 'アンティミテ ラ・ペティヤン 2024', '日本', 1870, 'グラス', 3),
         ('sparkling', 'ラッツェンベルガー バッハラッハー リースリング ゼクト ブリュット 2019', 'ドイツ', 1980, 'グラス', 4),
         ('white', 'シレーニ セラー・セレクション ソーヴィニヨン・ブラン 2025', 'ニュージーランド', 1100, 'グラス', 1),
         ('white', 'HBホールンダー', 'ドイツ', 1210, 'グラス', 2),
         ('white', 'ヴァイングート・ヴォルフ ピノ・グリ 2024', 'ドイツ', 1210, 'グラス', 3),
         ('white', 'ゲルト・ステップ ミネラルシュタイン リースリング 2024', 'ドイツ', 1430, 'グラス', 4),
         ('white', 'ドップ・オ・ムーラン ゲヴュルツトラミネール テール・エピセ 2023', 'フランス', 1540, 'グラス', 5),
         ('white', 'アンリ・ド・ブルゾー シャブリ', 'フランス', 1540, 'グラス', 6),
         ('red', 'ヴァイングート・ヴォルフ シュペートブルグンダー 2023', 'ドイツ', 1100, 'グラス', 1),
         ('red', 'ストラタム ピノ・ノワール 2024', 'ニュージーランド', 1210, 'グラス', 2),
         ('red', 'リンクリン シュペートブルグンダー トロッケン 2023', 'ドイツ', 1320, 'グラス', 3),
         ('bottles', 'ボトルワイン', 'ボトルワインはスタッフがご提案いたします', NULL, 'スタッフにおたずねください', 1),
         ('highball', '三郎丸ハイボール', NULL, 990, NULL, 1),
         ('highball', '余市ハイボール', NULL, 1100, NULL, 2)
       ) AS i(cat, name, description, price, price_note, sort_order) ON i.cat = c.key
 WHERE s.slug = 'cozene-base'
   AND NOT EXISTS (SELECT 1 FROM menu_items m WHERE m.store_id = s.id);

UPDATE menu_items m
   SET price_note = v.price_note, translations = v.tr
  FROM stores s,
       (VALUES
         ('越後もち豚のパテ・ド・カンパーニュ', NULL, '{"en": {"name": "Country pâté of Echigo Mochi pork"}}'::jsonb),
         ('フランス産栗のポタージュ', NULL, '{"en": {"name": "French chestnut velouté"}}'::jsonb),
         ('レバームース', NULL, '{"en": {"name": "Liver mousse"}}'::jsonb),
         ('仔羊のリエット', NULL, '{"en": {"name": "Lamb rillettes"}}'::jsonb),
         ('燻製ウフマヨ', NULL, '{"en": {"name": "Smoked egg mayonnaise"}}'::jsonb),
         ('フレンチフライ', NULL, '{"en": {"name": "French fries"}}'::jsonb),
         ('ジャンボンブラン', NULL, '{"en": {"name": "Jambon blanc (French cooked ham)"}}'::jsonb),
         ('燻製鴨ハムとレンズ豆のサラダ', NULL, '{"en": {"name": "Smoked duck ham and lentil salad"}}'::jsonb),
         ('フランス産生ハムとサラミの盛り合わせ', NULL, '{"en": {"name": "French cured ham and salami platter"}}'::jsonb),
         ('オニオングラタンスープ', NULL, '{"en": {"name": "French onion soup gratinée"}}'::jsonb),
         ('スモークサーモン', NULL, '{"en": {"name": "Smoked salmon"}}'::jsonb),
         ('鴨もも肉のコンフィ', NULL, '{"en": {"name": "Duck leg confit"}}'::jsonb),
         ('蝦夷鹿のロースト', NULL, '{"en": {"name": "Roast Ezo venison"}}'::jsonb),
         ('国産牛ロースト', NULL, '{"en": {"name": "Roast Japanese beef"}}'::jsonb),
         ('豪州産仔羊のロースト', NULL, '{"en": {"name": "Roast Australian lamb"}}'::jsonb),
         ('本日の魚料理', NULL, '{"en": {"name": "Fish of the day"}}'::jsonb),
         ('ブフ・ブルギニョン', NULL, '{"en": {"name": "Beef bourguignon"}}'::jsonb),
         ('蝦夷鹿のボロネーゼ リガトーニ', NULL, '{"en": {"name": "Rigatoni with Ezo venison bolognese"}}'::jsonb),
         ('コンテとキノコのリゾット', NULL, '{"en": {"name": "Comté and mushroom risotto"}}'::jsonb),
         ('バニラアイスとキャラメルアイス盛り合わせ', NULL, '{"en": {"name": "Vanilla and caramel ice cream"}}'::jsonb),
         ('タルトショコラ', NULL, '{"en": {"name": "Chocolate tart"}}'::jsonb),
         ('プティ・コトー ヴヴレー MT キュヴェ・レ・テュフィエール ブリュット 2022', 'グラス', '{"en": {"name": "Petit Coteau Vouvray MT Cuvée Les Tuffières Brut 2022", "description": "France", "price_note": "Glass"}}'::jsonb),
         ('ロータリ ブリュット プラチナ 2021', 'グラス', '{"en": {"name": "Rotari Brut Platino 2021", "description": "Italy", "price_note": "Glass"}}'::jsonb),
         ('アンティミテ ラ・ペティヤン 2024', 'グラス', '{"en": {"name": "Intimité La Pétillant 2024", "description": "Japan", "price_note": "Glass"}}'::jsonb),
         ('ラッツェンベルガー バッハラッハー リースリング ゼクト ブリュット 2019', 'グラス', '{"en": {"name": "Ratzenberger Bacharacher Riesling Sekt Brut 2019", "description": "Germany", "price_note": "Glass"}}'::jsonb),
         ('シレーニ セラー・セレクション ソーヴィニヨン・ブラン 2025', 'グラス', '{"en": {"name": "Sileni Cellar Selection Sauvignon Blanc 2025", "description": "New Zealand", "price_note": "Glass"}}'::jsonb),
         ('HBホールンダー', 'グラス', '{"en": {"name": "HB Holunder", "description": "Germany", "price_note": "Glass"}}'::jsonb),
         ('ヴァイングート・ヴォルフ ピノ・グリ 2024', 'グラス', '{"en": {"name": "Weingut Wolf Pinot Gris 2024", "description": "Germany", "price_note": "Glass"}}'::jsonb),
         ('ゲルト・ステップ ミネラルシュタイン リースリング 2024', 'グラス', '{"en": {"name": "Gerd Stepp Mineralstein Riesling 2024", "description": "Germany", "price_note": "Glass"}}'::jsonb),
         ('ドップ・オ・ムーラン ゲヴュルツトラミネール テール・エピセ 2023', 'グラス', '{"en": {"name": "Dopff au Moulin Gewurztraminer Terres Épicées 2023", "description": "France", "price_note": "Glass"}}'::jsonb),
         ('アンリ・ド・ブルゾー シャブリ', 'グラス', '{"en": {"name": "Henri de Bourzeau Chablis", "description": "France", "price_note": "Glass"}}'::jsonb),
         ('ヴァイングート・ヴォルフ シュペートブルグンダー 2023', 'グラス', '{"en": {"name": "Weingut Wolf Spätburgunder 2023", "description": "Germany", "price_note": "Glass"}}'::jsonb),
         ('ストラタム ピノ・ノワール 2024', 'グラス', '{"en": {"name": "Stratum Pinot Noir 2024", "description": "New Zealand", "price_note": "Glass"}}'::jsonb),
         ('リンクリン シュペートブルグンダー トロッケン 2023', 'グラス', '{"en": {"name": "Rinklin Spätburgunder Trocken 2023", "description": "Germany", "price_note": "Glass"}}'::jsonb),
         ('ボトルワイン', 'スタッフにおたずねください', '{"en": {"name": "Bottle wine", "description": "Our staff will be happy to suggest a bottle.", "price_note": "Ask our staff"}}'::jsonb),
         ('三郎丸ハイボール', NULL, '{"en": {"name": "Saburomaru Highball"}}'::jsonb),
         ('余市ハイボール', NULL, '{"en": {"name": "Yoichi Highball"}}'::jsonb)
       ) AS v(name, price_note, tr)
 WHERE s.slug = 'cozene-base' AND m.store_id = s.id AND m.name = v.name
   AND m.translations = '{}'::jsonb;

INSERT INTO benefits (store_id, key, title, description, rule)
SELECT s.id, 'first_visit_glass', 'グラスワイン1杯サービス', '初回ご来店のお礼です。この画面をスタッフにお見せください。', 'first_visit'
  FROM stores s WHERE s.slug = 'cozene-base'
ON CONFLICT (store_id, key) DO NOTHING;

UPDATE benefits b
   SET title = 'グラスワイン1杯サービス',
       description = '初回ご来店のお礼です。この画面をスタッフにお見せください。',
       translations = '{"en": {"title": "One free glass of wine", "description": "Welcome gift on your first visit. Show this screen to staff."}}'::jsonb
  FROM stores s
 WHERE s.slug = 'cozene-base' AND b.store_id = s.id AND b.key = 'first_visit_glass'
   AND b.translations = '{}'::jsonb;

-- Seats: 11 counter seats and 4 tables (admin → Table QR). Only fills an
-- unset layout, so the owner's own changes are kept.
UPDATE stores SET seat_layout = '{"counter": 11, "tables": 4, "other": []}'::jsonb
 WHERE slug = 'cozene-base' AND seat_layout = '{}'::jsonb;
