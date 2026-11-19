"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminPost } from "@/lib/admin-fetch";
import type { BusinessHours } from "@/lib/business-hours";
import { useTr } from "../../LangProvider";

const DAYS = [
  { ja: "日", en: "Sun" }, { ja: "月", en: "Mon" }, { ja: "火", en: "Tue" }, { ja: "水", en: "Wed" },
  { ja: "木", en: "Thu" }, { ja: "金", en: "Fri" }, { ja: "土", en: "Sat" },
];
// Closing time choices: any half hour, up to 05:00 the next morning.
const CLOSE_TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`)
  .filter((t) => t !== "00:00")
  .concat(["24:00"]);

/** Opening hours for table check-in: guests can check in only while open, once a day. */
export default function HoursForm({ hours }: { hours: BusinessHours }) {
  const router = useRouter();
  const tr = useTr();
  const [h, setH] = useState(hours);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const toggleDay = (d: number) =>
    setH({ ...h, closed_days: h.closed_days.includes(d) ? h.closed_days.filter((x) => x !== d) : [...h.closed_days, d].sort() });

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await adminPost("/api/admin/store/hours", { hours: h });
    setBusy(false);
    if (!res.ok) return setMsg({ kind: "err", text: res.error ?? tr("保存できませんでした", "Could not save") });
    setMsg({ kind: "ok", text: tr("保存しました。", "Saved.") });
    router.refresh();
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
        <input type="checkbox" checked={h.limit_checkin} onChange={(e) => setH({ ...h, limit_checkin: e.target.checked })} style={{ width: "auto" }} />
        {tr("営業時間内だけチェックインできるようにする", "Allow check-in only during opening hours")}
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        <div className="field">
          <label>{tr("開店", "Opens")}</label>
          <input type="time" value={h.open} onChange={(e) => setH({ ...h, open: e.target.value })} />
        </div>
        <div className="field">
          <label>{tr("閉店", "Closes")}</label>
          <select value={h.close} onChange={(e) => setH({ ...h, close: e.target.value })}>
            {CLOSE_TIMES.map((t) => (
              <option key={t} value={t}>
                {t <= h.open && t !== "24:00" ? tr(`翌 ${t}`, `${t} (next day)`) : t}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label>{tr("定休日", "Closed on")}</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {DAYS.map((d, i) => (
            <label key={i} style={{ display: "flex", gap: 4, alignItems: "center", fontWeight: 400 }}>
              <input type="checkbox" checked={h.closed_days.includes(i)} onChange={() => toggleDay(i)} style={{ width: "auto" }} />
              {tr(d.ja, d.en)}
            </label>
          ))}
        </div>
      </div>
      <div className="hint">
        {tr(
          "チェックインは1日1回（朝5時区切り）です。同じ日にもう一度QRを読み取ると、テーブル番号と人数だけが更新されます。定休日は予約カレンダーにも「休」と表示されます。",
          "One check-in per guest per day (days change at 5:00). Scanning again the same day only updates the table and party size. Closing days also show as 休 on the reservation calendar."
        )}
      </div>
      <div className="form-actions">
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? tr("保存中…", "Saving…") : tr("保存", "Save")}</button>
      </div>
      {msg && <div className={`alert ${msg.kind}`}>{msg.text}</div>}
    </div>
  );
}
