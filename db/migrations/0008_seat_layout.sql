-- Cozene — seat layout for the seat QR codes.
-- Idempotent: PGlite replays every migration on boot.
--
-- {"counter": 11, "tables": 4, "other": ["Terrace"]}
-- Each seat gets its own QR (admin → Table QR). The code in the QR (?table=)
-- is C1…C<counter> for counter seats, T1…T<tables> for tables, and the name
-- itself for "other". visits.table_no stores that code; the Mini App and the
-- admin show it as カウンター 3 / テーブル 2. Older QRs with a bare number
-- (?table=7) keep working and show as テーブル 7.
ALTER TABLE stores ADD COLUMN IF NOT EXISTS seat_layout jsonb NOT NULL DEFAULT '{}'::jsonb;
