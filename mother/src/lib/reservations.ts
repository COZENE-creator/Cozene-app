import { query, queryOne } from "./db";
import { pushText } from "./line";

/**
 * Table reservations from the Mini App 予約 tab. A guest sends a request; staff
 * confirm or decline it in Mother; the guest gets a LINE message in the
 * language they booked in. Times are Japan time.
 */

export type ReservationSettings = {
  enabled: boolean;
  /** First and last bookable start time, "HH:MM". */
  from: string;
  to: string;
  /** Minutes between slots. */
  step: number;
  max_party: number;
  /** How far ahead guests can book. */
  days_ahead: number;
};

export const DEFAULT_RESERVATION_SETTINGS: ReservationSettings = {
  enabled: true,
  from: "17:00",
  to: "21:30",
  step: 30,
  max_party: 8,
  days_ahead: 60,
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Stored settings merged over the defaults; bad values fall back to the default. */
export function normalizeSettings(raw: unknown): ReservationSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_RESERVATION_SETTINGS;
  const int = (v: unknown, min: number, max: number, def: number) =>
    Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : def;
  const from = typeof r.from === "string" && HHMM.test(r.from) ? r.from : d.from;
  let to = typeof r.to === "string" && HHMM.test(r.to) ? r.to : d.to;
  if (toMin(to) < toMin(from)) to = from;
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : d.enabled,
    from,
    to,
    step: int(r.step, 10, 120, d.step),
    max_party: int(r.max_party, 1, 30, d.max_party),
    days_ahead: int(r.days_ahead, 1, 365, d.days_ahead),
  };
}

export function timeSlots(s: ReservationSettings): string[] {
  const out: string[] = [];
  for (let m = toMin(s.from); m <= toMin(s.to); m += s.step) out.push(fromMin(m));
  return out;
}

export async function getReservationSettings(storeId: string): Promise<ReservationSettings> {
  const row = await queryOne<{ reservation_settings: unknown }>(
    `SELECT reservation_settings FROM stores WHERE id = $1`,
    [storeId]
  );
  return normalizeSettings(row?.reservation_settings);
}

export async function saveReservationSettings(storeId: string, s: ReservationSettings): Promise<void> {
  await query(`UPDATE stores SET reservation_settings = $2::jsonb, updated_at = now() WHERE id = $1`, [
    storeId,
    JSON.stringify(s),
  ]);
}

/** "YYYY-MM-DD" in Japan, `days` from today. */
function japanDate(days = 0): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date(Date.now() + days * 86_400_000));
}

// ─── guest side ────────────────────────────────────────────────────────────

export type GuestReservation = {
  id: string;
  reserved_for: string;
  party_size: number;
  name: string;
  status: "requested" | "confirmed" | "declined" | "cancelled";
  staff_message: string | null;
};

/** Error codes the Mini App translates. */
export type ReservationError =
  | "reservations_closed"
  | "invalid_date"
  | "invalid_time"
  | "invalid_party"
  | "name_required"
  | "too_many_requests";

export async function createReservation(input: {
  storeId: string;
  guestId: string;
  userId: string;
  date: string;
  time: string;
  partySize: number;
  name: string;
  phone: string | null;
  note: string | null;
  lang: string;
}): Promise<{ ok: true; reservation: GuestReservation } | { ok: false; error: ReservationError }> {
  const s = await getReservationSettings(input.storeId);
  if (!s.enabled) return { ok: false, error: "reservations_closed" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || input.date < japanDate(0) || input.date > japanDate(s.days_ahead)) {
    return { ok: false, error: "invalid_date" };
  }
  if (!timeSlots(s).includes(input.time)) return { ok: false, error: "invalid_time" };
  const reservedFor = new Date(`${input.date}T${input.time}:00+09:00`);
  if (Number.isNaN(reservedFor.getTime()) || reservedFor.getTime() < Date.now()) return { ok: false, error: "invalid_time" };
  if (!Number.isInteger(input.partySize) || input.partySize < 1 || input.partySize > s.max_party) {
    return { ok: false, error: "invalid_party" };
  }
  if (!input.name.trim()) return { ok: false, error: "name_required" };

  // A guest can't flood the list: at most 3 open requests at a time.
  const open = await queryOne<{ n: number }>(
    `SELECT count(*)::int AS n FROM reservations
      WHERE store_id = $1 AND guest_id = $2 AND status = 'requested' AND reserved_for > now()`,
    [input.storeId, input.guestId]
  );
  if ((open?.n ?? 0) >= 3) return { ok: false, error: "too_many_requests" };

  const row = await queryOne<GuestReservation>(
    `INSERT INTO reservations (store_id, guest_id, user_id, reserved_for, party_size, name, phone, note, lang)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, reserved_for, party_size, name, status, staff_message`,
    [input.storeId, input.guestId, input.userId, reservedFor.toISOString(), input.partySize,
     input.name.trim().slice(0, 60), input.phone?.trim().slice(0, 30) || null,
     input.note?.trim().slice(0, 500) || null, input.lang === "en" ? "en" : "ja"]
  );
  return { ok: true, reservation: row! };
}

/** The guest's upcoming reservations (and ones from the last day), newest first. */
export function listGuestReservations(storeId: string, guestId: string): Promise<GuestReservation[]> {
  return query<GuestReservation>(
    `SELECT id, reserved_for, party_size, name, status, staff_message
       FROM reservations
      WHERE store_id = $1 AND guest_id = $2 AND reserved_for > now() - interval '1 day'
      ORDER BY reserved_for`,
    [storeId, guestId]
  );
}

/** Guest cancels their own request or booking. */
export async function cancelByGuest(storeId: string, guestId: string, id: string): Promise<boolean> {
  const row = await queryOne(
    `UPDATE reservations SET status = 'cancelled', updated_at = now()
      WHERE id = $1 AND store_id = $2 AND guest_id = $3
        AND status IN ('requested', 'confirmed') AND reserved_for > now()
      RETURNING id`,
    [id, storeId, guestId]
  );
  return row !== null;
}

// ─── admin side ────────────────────────────────────────────────────────────

export type AdminReservation = GuestReservation & {
  phone: string | null;
  note: string | null;
  lang: string;
  user_id: string | null;
  display_name: string | null;
  is_friend: boolean | null;
  notified: boolean | null;
  notify_error: string | null;
  created_at: string;
};

/** Upcoming (from the start of today, Japan time) or past reservations. */
export function listReservations(storeId: string, when: "upcoming" | "past"): Promise<AdminReservation[]> {
  const startOfToday = `((now() AT TIME ZONE 'Asia/Tokyo')::date::timestamp AT TIME ZONE 'Asia/Tokyo')`;
  return query<AdminReservation>(
    `SELECT r.id, r.reserved_for, r.party_size, r.name, r.status, r.staff_message, r.phone, r.note,
            r.lang, r.user_id, u.display_name, u.is_friend, r.notified, r.notify_error, r.created_at
       FROM reservations r
       LEFT JOIN users u ON u.id = r.user_id
      WHERE r.store_id = $1 AND ${when === "upcoming" ? `r.reserved_for >= ${startOfToday}` : `r.reserved_for < ${startOfToday}`}
      ORDER BY r.reserved_for ${when === "upcoming" ? "ASC" : "DESC"}
      LIMIT 300`,
    [storeId]
  );
}

export async function countPendingReservations(storeId: string): Promise<number> {
  const row = await queryOne<{ n: number }>(
    `SELECT count(*)::int AS n FROM reservations
      WHERE store_id = $1 AND status = 'requested' AND reserved_for > now()`,
    [storeId]
  );
  return row?.n ?? 0;
}

/** "11月20日(木) 18:30" / "Thu, Nov 20, 18:30" in Japan time. */
export function formatReservationTime(iso: string, lang: string): string {
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions = { timeZone: "Asia/Tokyo", month: "short", day: "numeric", weekday: "short" };
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" }).format(d);
  if (lang === "en") return `${new Intl.DateTimeFormat("en-US", opts).format(d)}, ${time}`;
  const md = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "long", day: "numeric" }).format(d);
  const wd = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", weekday: "short" }).format(d);
  return `${md}(${wd}) ${time}`;
}

function replyText(storeName: string, r: AdminReservation, status: "confirmed" | "declined"): string {
  const when = formatReservationTime(r.reserved_for, r.lang);
  const extra = r.staff_message ? `\n\n${r.staff_message}` : "";
  if (r.lang === "en") {
    return status === "confirmed"
      ? `[${storeName}] Your reservation is confirmed.\n\nDate: ${when}\nParty: ${r.party_size}\nName: ${r.name}${extra}\n\nWe look forward to seeing you.`
      : `[${storeName}] We're sorry, we can't take a reservation at the requested time.\n\nRequested: ${when}\nParty: ${r.party_size}${extra}\n\nWe hope to welcome you on another day.`;
  }
  return status === "confirmed"
    ? `【${storeName}】ご予約が確定しました。\n\n日時：${when}\n人数：${r.party_size}名\nお名前：${r.name}様${extra}\n\nご来店を心よりお待ちしております。`
    : `【${storeName}】申し訳ございません。ご希望の日時はご予約をお受けできませんでした。\n\nご希望日時：${when}\n人数：${r.party_size}名${extra}\n\nまたのご予約をお待ちしております。`;
}

/**
 * Confirm or decline a request and send the guest a LINE message. The decision
 * is saved even when the message can't be delivered (e.g. the guest isn't a
 * friend of the official account); `notified` / `notify_error` record that.
 */
export async function decideReservation(
  storeId: string,
  id: string,
  status: "confirmed" | "declined",
  staffMessage: string | null
): Promise<{ ok: true; notified: boolean; error?: string } | { ok: false; error: "not_found" }> {
  const updated = await queryOne<{ id: string }>(
    `UPDATE reservations
        SET status = $3, staff_message = $4, decided_at = now(), updated_at = now()
      WHERE id = $1 AND store_id = $2 AND status IN ('requested', 'confirmed')
      RETURNING id`,
    [id, storeId, status, staffMessage?.trim().slice(0, 300) || null]
  );
  if (!updated) return { ok: false, error: "not_found" };

  const r = await queryOne<AdminReservation & { line_user_id: string | null; store_name: string }>(
    `SELECT r.*, u.line_user_id, s.name AS store_name
       FROM reservations r
       JOIN stores s ON s.id = r.store_id
       LEFT JOIN users u ON u.id = r.user_id
      WHERE r.id = $1`,
    [id]
  );
  let notified = false;
  let error: string | undefined;
  if (r?.line_user_id) {
    try {
      const res = await pushText(r.line_user_id, replyText(r.store_name, r, status));
      notified = res.ok;
      if (!res.ok) error = res.errorMessage;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  } else {
    error = "no LINE user";
  }
  await query(`UPDATE reservations SET notified = $2, notify_error = $3 WHERE id = $1`, [id, notified, error ?? null]);
  return { ok: true, notified, error };
}
