import { query, queryOne } from "./db";

/**
 * Opening hours used to limit table check-in (and to mark closed days in the
 * reservation calendar). All times are Japan time.
 */

export type BusinessHours = {
  /** Only allow check-in while the store is open. */
  limit_checkin: boolean;
  /** "HH:MM". close may be "24:00", or ≤ open when the night runs past midnight ("02:00"). */
  open: string;
  close: string;
  /** Weekdays the store is closed, 0 = Sunday. */
  closed_days: number[];
};

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  limit_checkin: true,
  open: "17:00",
  close: "24:00",
  closed_days: [],
};

/** A guest can check in once per business day; a business day starts at 05:00. */
const DAY_START_HOUR = 5;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export function normalizeHours(raw: unknown): BusinessHours {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_BUSINESS_HOURS;
  const open = typeof r.open === "string" && HHMM.test(r.open) ? r.open : d.open;
  const close = typeof r.close === "string" && (HHMM.test(r.close) || r.close === "24:00") ? r.close : d.close;
  const closed = Array.isArray(r.closed_days)
    ? Array.from(new Set(r.closed_days.filter((n): n is number => Number.isInteger(n) && n >= 0 && n <= 6))).sort()
    : d.closed_days;
  return {
    limit_checkin: typeof r.limit_checkin === "boolean" ? r.limit_checkin : d.limit_checkin,
    open,
    close,
    closed_days: closed.length === 7 ? d.closed_days : closed,
  };
}

export async function getBusinessHours(storeId: string): Promise<BusinessHours> {
  const row = await queryOne<{ business_hours: unknown }>(`SELECT business_hours FROM stores WHERE id = $1`, [storeId]);
  return normalizeHours(row?.business_hours);
}

export async function saveBusinessHours(storeId: string, h: BusinessHours): Promise<void> {
  await query(`UPDATE stores SET business_hours = $2::jsonb, updated_at = now() WHERE id = $1`, [storeId, JSON.stringify(h)]);
}

/** Japan-time date, minutes after midnight and weekday of an instant. */
function japanParts(at: Date): { ymd: string; min: number; wd: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short",
    }).formatToParts(at).map((x) => [x.type, x.value])
  );
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { ymd: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute), wd };
}

export function addDays(ymd: string, days: number): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Weekday (0 = Sunday) of a "YYYY-MM-DD" date. */
export const weekdayOf = (ymd: string) => new Date(ymd + "T00:00:00Z").getUTCDay();

/**
 * Is the store open at `at`, and which business day is it? A night that runs
 * past midnight belongs to the day it started.
 */
export function businessStatus(h: BusinessHours, at = new Date()): { open: boolean; day: string } {
  const { ymd, min, wd } = japanParts(at);
  const o = toMin(h.open);
  let c = h.close === "24:00" ? 1440 : toMin(h.close);
  if (c <= o) c += 1440;
  const closed = (w: number) => h.closed_days.includes(((w % 7) + 7) % 7);

  if (!closed(wd) && min >= o && min < c) return { open: true, day: ymd };
  if (!closed(wd - 1) && min + 1440 >= o && min + 1440 < c) return { open: true, day: addDays(ymd, -1) };
  return { open: false, day: min < DAY_START_HOUR * 60 ? addDays(ymd, -1) : ymd };
}

/** The instant a business day starts (05:00 Japan time). */
export function businessDayStart(day: string): Date {
  return new Date(`${day}T${String(DAY_START_HOUR).padStart(2, "0")}:00:00+09:00`);
}
