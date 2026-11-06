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
  '["img/entrance.jpg", "img/interior.jpg", "img/sign-night.jpg", "img/sign.jpg"]',
  '#c25a1e'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO menu_categories (store_id, key, label, sort_order)
SELECT s.id, c.key, c.label, c.sort_order
  FROM stores s,
       (VALUES
               ('entrees', 'Entrées · 前菜', 1),
               ('plats', 'Plats · メイン', 2),
               ('pates_risotto', 'Pâtes & Risotto · パスタ・リゾット', 3),
               ('desserts', 'Desserts · デセール', 4),
               ('sparkling', 'Sparkling · グラスワイン 泡', 5),
               ('white', 'White · グラスワイン 白', 6),
               ('red', 'Red · グラスワイン 赤', 7),
               ('bottles', 'Bottles · ボトルワイン', 8),
               ('highball', 'Highball · ハイボール', 9)
       ) AS c(key, label, sort_order)
 WHERE s.slug = 'cozene-base'
ON CONFLICT (store_id, key) DO NOTHING;

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
         ('sparkling', 'プティ・コトー ヴヴレー MT キュヴェ・レ・テュフィエール ブリュット 2022', 'フランス', 1320, 'Glass', 1),
         ('sparkling', 'ロータリ ブリュット プラチナ 2021', 'イタリア', 1430, 'Glass', 2),
         ('sparkling', 'アンティミテ ラ・ペティヤン 2024', '日本', 1870, 'Glass', 3),
         ('sparkling', 'ラッツェンベルガー バッハラッハー リースリング ゼクト ブリュット 2019', 'ドイツ', 1980, 'Glass', 4),
         ('white', 'シレーニ セラー・セレクション ソーヴィニヨン・ブラン 2025', 'ニュージーランド', 1100, 'Glass', 1),
         ('white', 'HBホールンダー', 'ドイツ', 1210, 'Glass', 2),
         ('white', 'ヴァイングート・ヴォルフ ピノ・グリ 2024', 'ドイツ', 1210, 'Glass', 3),
         ('white', 'ゲルト・ステップ ミネラルシュタイン リースリング 2024', 'ドイツ', 1430, 'Glass', 4),
         ('white', 'ドップ・オ・ムーラン ゲヴュルツトラミネール テール・エピセ 2023', 'フランス', 1540, 'Glass', 5),
         ('white', 'アンリ・ド・ブルゾー シャブリ', 'フランス', 1540, 'Glass', 6),
         ('red', 'ヴァイングート・ヴォルフ シュペートブルグンダー 2023', 'ドイツ', 1100, 'Glass', 1),
         ('red', 'ストラタム ピノ・ノワール 2024', 'ニュージーランド', 1210, 'Glass', 2),
         ('red', 'リンクリン シュペートブルグンダー トロッケン 2023', 'ドイツ', 1320, 'Glass', 3),
         ('bottles', 'ボトルワイン', 'ボトルワインはスタッフがご提案いたします', NULL, 'Ask our staff', 1),
         ('highball', '三郎丸ハイボール', NULL, 990, NULL, 1),
         ('highball', '余市ハイボール', NULL, 1100, NULL, 2)
       ) AS i(cat, name, description, price, price_note, sort_order) ON i.cat = c.key
 WHERE s.slug = 'cozene-base'
   AND NOT EXISTS (SELECT 1 FROM menu_items m WHERE m.store_id = s.id);

INSERT INTO benefits (store_id, key, title, description, rule)
SELECT s.id, 'first_visit_glass', 'One free glass of wine',
       'Welcome gift on your first visit. Show this screen to staff.', 'first_visit'
  FROM stores s WHERE s.slug = 'cozene-base'
ON CONFLICT (store_id, key) DO NOTHING;
