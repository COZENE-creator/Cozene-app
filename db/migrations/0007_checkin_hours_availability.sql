-- Cozene — check-in hours, reservation availability calendar, and the
-- request/reply history of each reservation.
-- Idempotent: PGlite replays every migration on boot.

-- ─── business hours (check-in) ──────────────────────────────────────────────
-- {"limit_checkin": true, "open": "17:00", "close": "24:00", "closed_days": [1]}
-- close ≤ open means the night runs past midnight ("02:00"). closed_days are
-- weekdays, 0 = Sunday. Check-in is allowed only while open, once per guest per
-- business day. Missing keys use the defaults in mother/src/lib/business-hours.ts.
ALTER TABLE stores ADD COLUMN IF NOT EXISTS business_hours jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ─── availability calendar ──────────────────────────────────────────────────
-- What the Mini App shows per day: open ○ / few △ (5 seats or fewer) / full ×.
-- Staff set it by hand; a day without a row is open (closed weekdays show 休).
CREATE TABLE IF NOT EXISTS reservation_availability (
  store_id   uuid NOT NULL REFERENCES stores(id),
  day        date NOT NULL,
  status     text NOT NULL CHECK (status IN ('open', 'few', 'full')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, day)
);

-- ─── reservations: "suggest another time" ───────────────────────────────────
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS proposed_for timestamptz;
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_status_check;
ALTER TABLE reservations ADD CONSTRAINT reservations_status_check
  CHECK (status IN ('requested', 'proposed', 'confirmed', 'declined', 'cancelled'));

-- ─── request / reply history ────────────────────────────────────────────────
-- Every step of a reservation: the guest's request, each staff reply (with the
-- LINE delivery result), the guest accepting a suggested time or cancelling.
CREATE TABLE IF NOT EXISTS reservation_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES reservations(id),
  store_id       uuid NOT NULL REFERENCES stores(id),
  actor          text NOT NULL CHECK (actor IN ('guest', 'staff')),
  staff_name     text,                -- admin email, or the LINE name of the staff member who replied
  action         text NOT NULL CHECK (action IN ('requested', 'confirmed', 'proposed', 'declined', 'cancelled', 'accepted')),
  message        text,
  proposed_for   timestamptz,
  notified       boolean,             -- LINE message delivered? NULL = none sent
  notify_error   text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reservation_events_resv ON reservation_events(reservation_id, created_at);

-- Backfill the history of reservations made before this migration.
INSERT INTO reservation_events (reservation_id, store_id, actor, action, message, created_at)
SELECT r.id, r.store_id, 'guest', 'requested', r.note, r.created_at
  FROM reservations r
 WHERE NOT EXISTS (SELECT 1 FROM reservation_events e WHERE e.reservation_id = r.id);

INSERT INTO reservation_events (reservation_id, store_id, actor, action, message, notified, notify_error, created_at)
SELECT r.id, r.store_id, 'staff', r.status, r.staff_message, r.notified, r.notify_error, r.decided_at
  FROM reservations r
 WHERE r.decided_at IS NOT NULL AND r.status IN ('confirmed', 'declined')
   AND NOT EXISTS (SELECT 1 FROM reservation_events e WHERE e.reservation_id = r.id AND e.actor = 'staff');
