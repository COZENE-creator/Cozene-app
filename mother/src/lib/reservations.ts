import { query, queryOne } from "./db";
import { pushText } from "./line";
import { signLink } from "./auth";
import type { Tr } from "./lang";
import { getBusinessHours, weekdayOf, addDays, type BusinessHours } from "./business-hours";

/**
 * Table reservations from the Mini App 予約 tab.
 *
 *   1. The guest picks a day on the availability calendar (○ / △ / ×, set by
 *      staff) and sends a request: time, party size, name, note.
 *   2. The staff LINE accounts chosen in Mother get the request with a reply
 *      link; they confirm, suggest another time, or decline from their phone
 *      (or from Mother's 予約 page).
 *   3. The guest gets each reply as a LINE message in the language they booked
 *      in, and can accept a suggested time in the Mini App.
 *
 * Every step is kept in reservation_events. Times are Japan time.
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
  /** users.id of the staff LINE accounts that get new requests. */
  notify_user_ids: string[];
};

export const DEFAULT_RESERVATION_SETTINGS: ReservationSettings = {
  enabled: true,
  from: "17:00",
  to: "21:30",
  step: 30,
  max_party: 8,
  days_ahead: 60,
  notify_user_ids: [],
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const clip = (v: string | null | undefined, n: number) => v?.trim().slice(0, n) || null;

/** Stored settings merged over the defaults; bad values fall back to the default. */
export function normalizeSettings(raw: unknown): ReservationSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_RESERVATION_SETTINGS;
  const int = (v: unknown, min: number, max: number, def: number) =>
    Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : def;
  const from = typeof r.from === "string" && HHMM.test(r.from) ? r.from : d.from;
  let to = typeof r.to === "string" && HHMM.test(r.to) ? r.to : d.to;
  if (toMin(to) < toMin(from)) to = from;
  const notify = Array.isArray(r.notify_user_ids)
    ? Array.from(new Set(r.notify_user_ids.filter((v): v is string => typeof v === "string" && UUID.test(v)))).slice(0, 10)
    : d.notify_user_ids;
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : d.enabled,
    from,
    to,
    step: int(r.step, 10, 120, d.step),
    max_party: int(r.max_party, 1, 30, d.max_party),
    days_ahead: int(r.days_ahead, 1, 365, d.days_ahead),
    notify_user_ids: notify,
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
export function japanDate(days = 0): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date(Date.now() + days * 86_400_000));
}

// ─── availability calendar ─────────────────────────────────────────────────

/** open ○ · few △ (5 seats or fewer) · full × — set by staff. closed = regular closing day. */
export type DayStatus = "open" | "few" | "full" | "closed";
export type CalendarDay = { date: string; status: DayStatus; /** staff set it (vs. the default) */ set: boolean };

/** Every day from today to `days_ahead`, with its status. */
export async function getCalendar(
  storeId: string,
  settings?: ReservationSettings,
  hours?: BusinessHours
): Promise<CalendarDay[]> {
  const [s, h] = await Promise.all([
    settings ?? getReservationSettings(storeId),
    hours ?? getBusinessHours(storeId),
  ]);
  const today = japanDate(0);
  const last = addDays(today, s.days_ahead);
  const rows = await query<{ day: string; status: "open" | "few" | "full" }>(
    `SELECT to_char(day, 'YYYY-MM-DD') AS day, status FROM reservation_availability
      WHERE store_id = $1 AND day BETWEEN $2::date AND $3::date`,
    [storeId, today, last]
  );
  const set = new Map(rows.map((r) => [r.day, r.status]));
  const out: CalendarDay[] = [];
  for (let d = today; d <= last; d = addDays(d, 1)) {
    const v = set.get(d);
    out.push({ date: d, status: v ?? (h.closed_days.includes(weekdayOf(d)) ? "closed" : "open"), set: v !== undefined });
  }
  return out;
}

/** Set a day's status; null goes back to the default (open, or closed on a closing day). */
export async function setAvailability(storeId: string, day: string, status: "open" | "few" | "full" | null): Promise<void> {
  if (!YMD.test(day)) throw new Error("bad day");
  if (status === null) {
    await query(`DELETE FROM reservation_availability WHERE store_id = $1 AND day = $2::date`, [storeId, day]);
    return;
  }
  await query(
    `INSERT INTO reservation_availability (store_id, day, status) VALUES ($1, $2::date, $3)
     ON CONFLICT (store_id, day) DO UPDATE SET status = EXCLUDED.status, updated_at = now()`,
    [storeId, day, status]
  );
}

// ─── formatting + LINE messages ────────────────────────────────────────────

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

type Full = {
  id: string;
  store_id: string;
  store_name: string;
  store_slug: string;
  reserved_for: string;
  proposed_for: string | null;
  party_size: number;
  name: string;
  phone: string | null;
  note: string | null;
  lang: string;
  status: Status;
  user_id: string | null;
  line_user_id: string | null;
  display_name: string | null;
};

async function loadFull(id: string): Promise<Full | null> {
  if (!UUID.test(id)) return null;
  return queryOne<Full>(
    `SELECT r.id, r.store_id, s.name AS store_name, s.slug AS store_slug, r.reserved_for, r.proposed_for,
            r.party_size, r.name, r.phone, r.note, r.lang, r.status, r.user_id, u.line_user_id, u.display_name
       FROM reservations r
       JOIN stores s ON s.id = r.store_id
       LEFT JOIN users u ON u.id = r.user_id
      WHERE r.id = $1`,
    [id]
  );
}

/** Mini App link for the guest's LINE message, when the LIFF id is configured. */
function miniAppLink(slug: string): string {
  const liff = process.env.MINIAPP_LIFF_ID?.trim();
  return liff ? `\nhttps://miniapp.line.me/${liff}?store=${encodeURIComponent(slug)}` : "";
}

/** The guest's LINE message for a staff reply. */
function guestText(r: Full, action: "confirmed" | "proposed" | "declined", message: string | null): string {
  const en = r.lang === "en";
  const when = formatReservationTime(r.reserved_for, r.lang);
  const extra = message ? `\n\n${message}` : "";
  const link = miniAppLink(r.store_slug);
  if (action === "confirmed") {
    return en
      ? `[${r.store_name}] Your reservation is confirmed.\n\nDate: ${when}\nParty: ${r.party_size}\nName: ${r.name}${extra}\n\nWe look forward to seeing you.`
      : `【${r.store_name}】ご予約が確定しました。\n\n日時：${when}\n人数：${r.party_size}名\nお名前：${r.name}様${extra}\n\nご来店を心よりお待ちしております。`;
  }
  if (action === "proposed") {
    const proposed = r.proposed_for ? formatReservationTime(r.proposed_for, r.lang) : null;
    if (en) {
      return `[${r.store_name}] We can't take your requested time, but we'd like to suggest another.\n\nRequested: ${when}` +
        (proposed ? `\nSuggested: ${proposed}` : "") + `\nParty: ${r.party_size}${extra}\n\n` +
        (proposed ? "You can book the suggested time from the Reservation tab of our Mini App." : "Please send a new request from our Mini App.") + link;
    }
    return `【${r.store_name}】ご希望の日時はご用意が難しいため、別の日時をご提案いたします。\n\nご希望：${when}` +
      (proposed ? `\nご提案：${proposed}` : "") + `\n人数：${r.party_size}名${extra}\n\n` +
      (proposed ? "ミニアプリの「予約」タブから、ご提案の日時でご予約いただけます。" : "お手数ですが、ミニアプリから改めてご予約リクエストをお送りください。") + link;
  }
  return en
    ? `[${r.store_name}] We're sorry, we can't take a reservation at the requested time.\n\nRequested: ${when}\nParty: ${r.party_size}${extra}\n\nWe hope to welcome you on another day.`
    : `【${r.store_name}】申し訳ございません。ご希望の日時はご予約をお受けできませんでした。\n\nご希望日時：${when}\n人数：${r.party_size}名${extra}\n\nまたのご予約をお待ちしております。`;
}

/** Link a staff member opens on their phone to reply without logging in. */
export function staffReplyLink(baseUrl: string, reservationId: string, staffUserId: string): string {
  return `${baseUrl}/r/${reservationId}?u=${staffUserId}&t=${signLink(`resv:${reservationId}:${staffUserId}`)}`;
}

/** Staff LINE message (Japanese — the store's working language). */
function staffText(r: Full, kind: "requested" | "cancelled" | "accepted" | "test", link: string): string {
  const when = formatReservationTime(r.reserved_for, "ja");
  const head = {
    requested: "新しい予約リクエストが届きました。",
    cancelled: "お客様が予約をキャンセルしました。",
    accepted: "お客様がご提案の日時で予約しました（確定済み）。",
    test: "予約通知のテストです。新しいリクエストはこのように届きます。",
  }[kind];
  const lines = [
    `【${r.store_name}】${head}`,
    "",
    `日時：${when}`,
    `人数：${r.party_size}名`,
    `お名前：${r.name}様${r.display_name && r.display_name !== r.name ? `（LINE：${r.display_name}）` : ""}`,
    r.phone ? `電話：${r.phone}` : null,
    r.note ? `ご要望：${r.note}` : null,
    r.lang === "en" ? "※英語でのご案内を希望" : null,
    "",
    kind === "requested" || kind === "test" ? `▼確定・別の日時の提案・お断りはこちら\n${link}` : `▼詳細\n${link}`,
  ];
  return lines.filter((l) => l !== null).join("\n");
}

type PushOutcome = { notified: boolean; error: string | null };

async function push(to: string | null, text: string): Promise<PushOutcome> {
  if (!to) return { notified: false, error: "no LINE user" };
  try {
    const res = await pushText(to, text);
    return { notified: res.ok, error: res.ok ? null : res.errorMessage ?? `HTTP ${res.status}` };
  } catch (err) {
    return { notified: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Staff accounts that get reservation messages (LINE friends only can be messaged). */
export type StaffRecipient = { id: string; display_name: string | null; line_user_id: string; is_friend: boolean };

export function listStaffRecipients(storeId: string, ids: string[]): Promise<StaffRecipient[]> {
  if (!ids.length) return Promise.resolve([]);
  return query<StaffRecipient>(
    `SELECT id, display_name, line_user_id, is_friend FROM users
      WHERE store_id = $1 AND id = ANY($2::uuid[]) AND line_user_id IS NOT NULL`,
    [storeId, ids]
  );
}

/** Send a reservation to every staff recipient. Returns how many got it. */
async function notifyStaff(r: Full, kind: "requested" | "cancelled" | "accepted" | "test", baseUrl: string): Promise<{ sent: number; failed: string[] }> {
  const s = await getReservationSettings(r.store_id);
  const staff = await listStaffRecipients(r.store_id, s.notify_user_ids);
  let sent = 0;
  const failed: string[] = [];
  for (const u of staff) {
    const out = await push(u.line_user_id, staffText(r, kind, staffReplyLink(baseUrl, r.id, u.id)));
    if (out.notified) sent++;
    else failed.push(`${u.display_name ?? u.id}: ${out.error}`);
  }
  if (failed.length) console.warn(`[reservations] staff LINE message failed for ${r.id}:`, failed);
  return { sent, failed };
}

/** Send a sample request to the staff recipients so they can check the setup. */
export async function sendStaffTest(storeId: string, baseUrl: string): Promise<{ sent: number; failed: string[]; recipients: number }> {
  const s = await getReservationSettings(storeId);
  const store = await queryOne<{ name: string; slug: string }>(`SELECT name, slug FROM stores WHERE id = $1`, [storeId]);
  const sample: Full = {
    id: "00000000-0000-0000-0000-000000000000", store_id: storeId, store_name: store?.name ?? "", store_slug: store?.slug ?? "",
    reserved_for: new Date(`${japanDate(1)}T19:00:00+09:00`).toISOString(), proposed_for: null, party_size: 2,
    name: "テスト", phone: null, note: null, lang: "ja", status: "requested", user_id: null, line_user_id: null, display_name: null,
  };
  const staff = await listStaffRecipients(storeId, s.notify_user_ids);
  let sent = 0;
  const failed: string[] = [];
  for (const u of staff) {
    const out = await push(u.line_user_id, staffText(sample, "test", `${baseUrl}/reservations`));
    if (out.notified) sent++;
    else failed.push(`${u.display_name ?? u.id}: ${out.error}`);
  }
  return { sent, failed, recipients: staff.length };
}

async function addEvent(e: {
  reservationId: string;
  storeId: string;
  actor: "guest" | "staff";
  staffName?: string | null;
  action: EventAction;
  message?: string | null;
  proposedFor?: string | null;
  notified?: boolean | null;
  notifyError?: string | null;
}): Promise<void> {
  await query(
    `INSERT INTO reservation_events (reservation_id, store_id, actor, staff_name, action, message, proposed_for, notified, notify_error)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [e.reservationId, e.storeId, e.actor, e.staffName ?? null, e.action, e.message ?? null,
     e.proposedFor ?? null, e.notified ?? null, e.notifyError ?? null]
  );
}

// ─── guest side ────────────────────────────────────────────────────────────

type Status = "requested" | "proposed" | "confirmed" | "declined" | "cancelled";
type EventAction = "requested" | "confirmed" | "proposed" | "declined" | "cancelled" | "accepted";

export type GuestReservation = {
  id: string;
  reserved_for: string;
  proposed_for: string | null;
  party_size: number;
  name: string;
  status: Status;
  staff_message: string | null;
};

/** Error codes the Mini App translates. */
export type ReservationError =
  | "reservations_closed"
  | "invalid_date"
  | "date_full"
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
  baseUrl: string;
}): Promise<{ ok: true; reservation: GuestReservation } | { ok: false; error: ReservationError }> {
  const s = await getReservationSettings(input.storeId);
  if (!s.enabled) return { ok: false, error: "reservations_closed" };
  if (!YMD.test(input.date) || input.date < japanDate(0) || input.date > japanDate(s.days_ahead)) {
    return { ok: false, error: "invalid_date" };
  }
  const day = (await getCalendar(input.storeId, s)).find((d) => d.date === input.date);
  if (!day || day.status === "full" || day.status === "closed") return { ok: false, error: "date_full" };
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
      WHERE store_id = $1 AND guest_id = $2 AND status IN ('requested', 'proposed') AND reserved_for > now()`,
    [input.storeId, input.guestId]
  );
  if ((open?.n ?? 0) >= 3) return { ok: false, error: "too_many_requests" };

  const note = clip(input.note, 500);
  const row = await queryOne<GuestReservation>(
    `INSERT INTO reservations (store_id, guest_id, user_id, reserved_for, party_size, name, phone, note, lang)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, reserved_for, proposed_for, party_size, name, status, staff_message`,
    [input.storeId, input.guestId, input.userId, reservedFor.toISOString(), input.partySize,
     input.name.trim().slice(0, 60), clip(input.phone, 30), note, input.lang === "en" ? "en" : "ja"]
  );
  await addEvent({ reservationId: row!.id, storeId: input.storeId, actor: "guest", action: "requested", message: note });
  const full = await loadFull(row!.id);
  if (full) await notifyStaff(full, "requested", input.baseUrl);
  return { ok: true, reservation: row! };
}

/** The guest's upcoming reservations (and ones from the last day), soonest first. */
export function listGuestReservations(storeId: string, guestId: string): Promise<GuestReservation[]> {
  return query<GuestReservation>(
    `SELECT id, reserved_for, proposed_for, party_size, name, status, staff_message
       FROM reservations
      WHERE store_id = $1 AND guest_id = $2 AND reserved_for > now() - interval '1 day'
      ORDER BY reserved_for`,
    [storeId, guestId]
  );
}

/** Guest cancels their request or booking (or turns down a suggested time). */
export async function cancelByGuest(storeId: string, guestId: string, id: string, baseUrl: string): Promise<boolean> {
  if (!UUID.test(id)) return false;
  const row = await queryOne<{ id: string }>(
    `UPDATE reservations SET status = 'cancelled', updated_at = now()
      WHERE id = $1 AND store_id = $2 AND guest_id = $3
        AND status IN ('requested', 'proposed', 'confirmed') AND reserved_for > now()
      RETURNING id`,
    [id, storeId, guestId]
  );
  if (!row) return false;
  await addEvent({ reservationId: id, storeId, actor: "guest", action: "cancelled" });
  const full = await loadFull(id);
  if (full) await notifyStaff(full, "cancelled", baseUrl);
  return true;
}

/** Guest books the time staff suggested: the reservation is confirmed at that time. */
export async function acceptProposal(storeId: string, guestId: string, id: string, baseUrl: string): Promise<boolean> {
  if (!UUID.test(id)) return false;
  const row = await queryOne<{ id: string; proposed_for: string }>(
    `UPDATE reservations
        SET status = 'confirmed', reserved_for = proposed_for, updated_at = now()
      WHERE id = $1 AND store_id = $2 AND guest_id = $3
        AND status = 'proposed' AND proposed_for IS NOT NULL AND proposed_for > now()
      RETURNING id, proposed_for`,
    [id, storeId, guestId]
  );
  if (!row) return false;
  await addEvent({ reservationId: id, storeId, actor: "guest", action: "accepted", proposedFor: row.proposed_for });
  const full = await loadFull(id);
  if (full) await notifyStaff(full, "accepted", baseUrl);
  return true;
}

// ─── staff side ────────────────────────────────────────────────────────────

export type ReservationEvent = {
  id: string;
  reservation_id: string;
  actor: "guest" | "staff";
  staff_name: string | null;
  action: EventAction;
  message: string | null;
  proposed_for: string | null;
  notified: boolean | null;
  notify_error: string | null;
  created_at: string;
};

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
  events: ReservationEvent[];
};

const ADMIN_COLUMNS = `r.id, r.reserved_for, r.proposed_for, r.party_size, r.name, r.status, r.staff_message, r.phone,
  r.note, r.lang, r.user_id, u.display_name, u.is_friend, r.notified, r.notify_error, r.created_at`;

async function withEvents(rows: Omit<AdminReservation, "events">[]): Promise<AdminReservation[]> {
  if (!rows.length) return [];
  const events = await query<ReservationEvent>(
    `SELECT id, reservation_id, actor, staff_name, action, message, proposed_for, notified, notify_error, created_at
       FROM reservation_events WHERE reservation_id = ANY($1::uuid[]) ORDER BY created_at`,
    [rows.map((r) => r.id)]
  );
  return rows.map((r) => ({ ...r, events: events.filter((e) => e.reservation_id === r.id) }));
}

/** Upcoming (from the start of today, Japan time) or past reservations. */
export async function listReservations(storeId: string, when: "upcoming" | "past"): Promise<AdminReservation[]> {
  const startOfToday = `((now() AT TIME ZONE 'Asia/Tokyo')::date::timestamp AT TIME ZONE 'Asia/Tokyo')`;
  const rows = await query<Omit<AdminReservation, "events">>(
    `SELECT ${ADMIN_COLUMNS}
       FROM reservations r
       LEFT JOIN users u ON u.id = r.user_id
      WHERE r.store_id = $1 AND ${when === "upcoming" ? `r.reserved_for >= ${startOfToday}` : `r.reserved_for < ${startOfToday}`}
      ORDER BY r.reserved_for ${when === "upcoming" ? "ASC" : "DESC"}
      LIMIT 300`,
    [storeId]
  );
  return withEvents(rows);
}

/** All reservations of one customer (customer detail page). */
export async function listCustomerReservations(userId: string): Promise<AdminReservation[]> {
  if (!UUID.test(userId)) return [];
  const rows = await query<Omit<AdminReservation, "events">>(
    `SELECT ${ADMIN_COLUMNS}
       FROM reservations r
       LEFT JOIN users u ON u.id = r.user_id
      WHERE r.user_id = $1
      ORDER BY r.reserved_for DESC
      LIMIT 100`,
    [userId]
  );
  return withEvents(rows);
}

/** One reservation with its history (the staff reply page). */
export async function getReservationForStaff(id: string): Promise<(AdminReservation & { store_id: string; store_name: string }) | null> {
  if (!UUID.test(id)) return null;
  const row = await queryOne<Omit<AdminReservation, "events"> & { store_id: string; store_name: string }>(
    `SELECT ${ADMIN_COLUMNS}, r.store_id, s.name AS store_name
       FROM reservations r
       JOIN stores s ON s.id = r.store_id
       LEFT JOIN users u ON u.id = r.user_id
      WHERE r.id = $1`,
    [id]
  );
  if (!row) return null;
  const [withHistory] = await withEvents([row]);
  return { ...withHistory, store_id: row.store_id, store_name: row.store_name };
}

export async function countPendingReservations(storeId: string): Promise<number> {
  const row = await queryOne<{ n: number }>(
    `SELECT count(*)::int AS n FROM reservations
      WHERE store_id = $1 AND status = 'requested' AND reserved_for > now()`,
    [storeId]
  );
  return row?.n ?? 0;
}

export type StaffReply =
  | { action: "confirm"; message: string | null }
  | { action: "propose"; message: string | null; date: string | null; time: string | null }
  | { action: "decline"; message: string | null };

export type ReplyResult =
  | { ok: true; notified: boolean; error: string | null }
  | { ok: false; error: "not_found" | "not_open" | "bad_proposal" };

/**
 * Staff reply to a reservation — confirm, suggest another time, or decline —
 * and the guest's LINE message. The reply is saved even when the message can't
 * be delivered (e.g. the guest isn't a friend of the official account); the
 * event records whether it was.
 */
export async function replyToReservation(storeId: string, id: string, reply: StaffReply, staffName: string | null): Promise<ReplyResult> {
  const current = await loadFull(id);
  if (!current || current.store_id !== storeId) return { ok: false, error: "not_found" };
  const message = clip(reply.message, 500);

  let status: "confirmed" | "proposed" | "declined";
  let proposedFor: string | null = null;
  if (reply.action === "confirm") {
    if (!["requested", "proposed"].includes(current.status)) return { ok: false, error: "not_open" };
    status = "confirmed";
  } else if (reply.action === "propose") {
    if (!["requested", "proposed", "confirmed"].includes(current.status)) return { ok: false, error: "not_open" };
    if (reply.date || reply.time) {
      if (!reply.date || !YMD.test(reply.date) || !reply.time || !HHMM.test(reply.time)) return { ok: false, error: "bad_proposal" };
      const at = new Date(`${reply.date}T${reply.time}:00+09:00`);
      if (Number.isNaN(at.getTime()) || at.getTime() < Date.now()) return { ok: false, error: "bad_proposal" };
      proposedFor = at.toISOString();
    } else if (!message) {
      return { ok: false, error: "bad_proposal" };
    }
    status = "proposed";
  } else {
    if (!["requested", "proposed", "confirmed"].includes(current.status)) return { ok: false, error: "not_open" };
    status = "declined";
  }

  await query(
    `UPDATE reservations
        SET status = $3, staff_message = $4, proposed_for = $5, decided_at = now(), updated_at = now()
      WHERE id = $1 AND store_id = $2`,
    [id, storeId, status, message, proposedFor]
  );
  const r = (await loadFull(id))!;
  const out = await push(r.line_user_id, guestText(r, status, message));
  await query(`UPDATE reservations SET notified = $2, notify_error = $3 WHERE id = $1`, [id, out.notified, out.error]);
  await addEvent({
    reservationId: id, storeId, actor: "staff", staffName, action: status, message, proposedFor,
    notified: out.notified, notifyError: out.error,
  });
  return { ok: true, notified: out.notified, error: out.error };
}

/** Bilingual message for a failed staff reply. */
export function replyErrorText(error: Extract<ReplyResult, { ok: false }>["error"], tr: Tr): string {
  if (error === "bad_proposal") {
    return tr("ご提案の日時（今より後）か、お客様へのメッセージを入力してください", "Enter a suggested date and time (in the future), or a message to the guest");
  }
  return tr("この予約は変更できません（キャンセル済みなど）", "This reservation can't be changed (e.g. it was cancelled)");
}
