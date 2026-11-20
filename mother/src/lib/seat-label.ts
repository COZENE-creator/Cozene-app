/**
 * Seat codes printed in the seat QR (?table=): C3 = counter seat 3, T2 = table
 * 2, anything else is shown as a table name (older QRs used a bare number).
 * No database import, so client components can use it too (the database side
 * is in seats.ts).
 */
export function seatLabel(code: string, tr: (ja: string, en: string) => string): string {
  const m = /^([CT])(\d+)$/i.exec(code);
  if (!m) return tr(`テーブル ${code}`, `Table ${code}`);
  return m[1].toUpperCase() === "C" ? tr(`カウンター ${m[2]}`, `Counter ${m[2]}`) : tr(`テーブル ${m[2]}`, `Table ${m[2]}`);
}

/** How many counter seats and tables a store has; each gets its own QR. */
export type SeatLayout = {
  counter: number;
  tables: number;
  /** Extra seats by name ("Terrace"), used as-is in the QR. */
  other: string[];
};

const MAX = 99;

export function normalizeSeatLayout(raw: unknown): SeatLayout {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const count = (v: unknown) => (Number.isInteger(v) ? Math.min(MAX, Math.max(0, v as number)) : 0);
  const other = Array.isArray(r.other)
    ? Array.from(new Set(r.other.filter((s): s is string => typeof s === "string").map((s) => s.trim().slice(0, 16)).filter(Boolean))).slice(0, 50)
    : [];
  return { counter: count(r.counter), tables: count(r.tables), other };
}

/** C1…Cn, T1…Tn, then the named seats: the codes printed in the QRs. */
export function seatCodes(l: SeatLayout): string[] {
  return [
    ...Array.from({ length: l.counter }, (_, i) => `C${i + 1}`),
    ...Array.from({ length: l.tables }, (_, i) => `T${i + 1}`),
    ...l.other,
  ];
}
