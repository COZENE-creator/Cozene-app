"use client";

import { useState } from "react";
import { adminPost } from "@/lib/admin-fetch";
import type { CalendarDay, DayStatus } from "@/lib/reservations";
import { useTr, useLang } from "../../LangProvider";

const MARK: Record<DayStatus, string> = { open: "○", few: "△", full: "×", closed: "休" };
const WEEK = { ja: ["日", "月", "火", "水", "木", "金", "土"], en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] };

/** open → few → full → back to the default (open, or 休 on a regular closing day). */
function next(d: CalendarDay): "open" | "few" | "full" | null {
  if (d.status === "closed") return "open";
  if (d.status === "open") return "few";
  if (d.status === "few") return "full";
  return null;
}

/**
 * The ○ / △ / × calendar guests see in the Mini App 予約 tab. Tap a day to
 * change it; it saves straight away.
 */
export default function AvailabilityCalendar({
  days,
  requests,
  closedDays,
}: {
  days: CalendarDay[];
  requests: Record<string, number>;
  /** Regular closing weekdays (0 = Sunday): a reset day goes back to 休. */
  closedDays: number[];
}) {
  const tr = useTr();
  const lang = useLang();
  const [state, setState] = useState(days);
  const [err, setErr] = useState("");

  async function tap(d: CalendarDay) {
    const status = next(d);
    const prev = state;
    const weekday = new Date(d.date + "T00:00:00Z").getUTCDay();
    const updated: CalendarDay = status
      ? { ...d, status, set: true }
      : { ...d, status: closedDays.includes(weekday) ? "closed" : "open", set: false };
    setState(state.map((x) => (x.date === d.date ? updated : x)));
    setErr("");
    const res = await adminPost("/api/admin/reservations", { action: "availability", day: d.date, status });
    if (!res.ok) {
      setState(prev);
      setErr(res.error ?? tr("保存できませんでした", "Could not save"));
    }
  }

  // Group by month, padding each month's first week.
  const months: { key: string; label: string; cells: (CalendarDay | null)[] }[] = [];
  for (const d of state) {
    const key = d.date.slice(0, 7);
    let m = months.find((x) => x.key === key);
    if (!m) {
      const [y, mo] = key.split("-").map(Number);
      const label = lang === "en"
        ? new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
        : `${y}年${mo}月`;
      m = { key, label, cells: Array(new Date(d.date + "T00:00:00Z").getUTCDay()).fill(null) };
      months.push(m);
    }
    m.cells.push(d);
  }

  return (
    <div>
      <div className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
        {tr(
          "日付をタップすると ○ 空席あり → △ 残りわずか（5席以下）→ × 満席 → 元に戻す の順に切り替わり、すぐに保存されます。× と 休（定休日）の日はリクエストできません。",
          "Tap a day to switch ○ available → △ few seats (5 or fewer) → × full → back to default. It saves straight away. Guests can't request × or 休 (regular closing) days."
        )}
      </div>
      {err && <div className="alert err">{err}</div>}
      <div className="cal-months">
        {months.map((m) => (
          <div key={m.key} className="cal">
            <div className="cal-title">{m.label}</div>
            <div className="cal-grid">
              {WEEK[lang === "en" ? "en" : "ja"].map((w, i) => (
                <div key={w} className={`cal-wd ${i === 0 ? "sun" : i === 6 ? "sat" : ""}`}>{w}</div>
              ))}
              {m.cells.map((d, i) =>
                d ? (
                  <button key={d.date} type="button" className={`cal-day ${d.status}${d.set ? " set" : ""}`} onClick={() => tap(d)} title={d.date}>
                    <span className="n">{Number(d.date.slice(8))}</span>
                    <span className="m">{MARK[d.status]}</span>
                    {requests[d.date] ? <span className="r">{requests[d.date]}</span> : null}
                  </button>
                ) : (
                  <div key={`b${i}`} />
                )
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="hint">{tr("右上の数字は、その日のリクエスト・予約の件数です。", "The small number is how many requests and bookings that day has.")}</div>
    </div>
  );
}

