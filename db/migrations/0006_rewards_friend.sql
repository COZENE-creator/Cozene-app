-- 0006 — member rewards text + "add friend" link (Mini App).
--
--   stores.rewards_text     free text for the member rewards, e.g. "1回目のご来店：グラスワイン1杯
--                           3回目のご来店：特別なグラスワイン1杯". English in translations.en.rewards_text.
--   stores.line_friend_url  the Official Account's add-friend link (https://lin.ee/… or
--                           https://line.me/R/ti/p/@…). Shown as a 友だち追加 button.

ALTER TABLE stores ADD COLUMN IF NOT EXISTS rewards_text    text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS line_friend_url text;
