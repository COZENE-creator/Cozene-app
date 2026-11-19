"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminPost } from "@/lib/admin-fetch";
import type { ReservationSettings } from "@/lib/reservations";
import { useTr } from "../../LangProvider";

/** Booking hours shown in the Mini App's 予約 tab. */
export default function ReservationSettingsForm({ settings }: { settings: ReservationSettings }) {
  const router = useRouter();
  const tr = useTr();
  const [s, setS] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const num = (v: string) => Number(v.replace(/[^\d]/g, "")) || 0;

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await adminPost("/api/admin/reservations", { action: "settings", settings: s });
    setBusy(false);
    if (!res.ok) return setMsg({ kind: "err", text: res.error ?? tr("保存できませんでした", "Could not save") });
    setMsg({ kind: "ok", text: tr("保存しました。ミニアプリに反映されます。", "Saved. The Mini App uses the new hours.") });
    router.refresh();
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
        <input type="checkbox" checked={s.enabled} onChange={(e) => setS({ ...s, enabled: e.target.checked })} style={{ width: "auto" }} />
        {tr("ミニアプリで予約リクエストを受け付ける", "Accept reservation requests in the Mini App")}
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
        <div className="field">
          <label>{tr("最初の時間", "First time")}</label>
          <input type="time" value={s.from} onChange={(e) => setS({ ...s, from: e.target.value })} />
        </div>
        <div className="field">
          <label>{tr("最後の時間", "Last time")}</label>
          <input type="time" value={s.to} onChange={(e) => setS({ ...s, to: e.target.value })} />
        </div>
        <div className="field">
          <label>{tr("間隔（分）", "Every (minutes)")}</label>
          <input inputMode="numeric" value={s.step} onChange={(e) => setS({ ...s, step: num(e.target.value) })} />
        </div>
        <div className="field">
          <label>{tr("最大人数", "Max party")}</label>
          <input inputMode="numeric" value={s.max_party} onChange={(e) => setS({ ...s, max_party: num(e.target.value) })} />
        </div>
        <div className="field">
          <label>{tr("受付期間（日先まで）", "Book up to (days ahead)")}</label>
          <input inputMode="numeric" value={s.days_ahead} onChange={(e) => setS({ ...s, days_ahead: num(e.target.value) })} />
        </div>
      </div>
      <div className="hint">
        {tr(
          "お客様は「最初の時間」から「最後の時間」まで、指定した間隔で来店時間を選べます。大人数のご予約はお電話でのご案内になります。",
          "Guests pick a start time from the first to the last time, at the interval set. Larger groups are asked to call."
        )}
      </div>
      <div className="form-actions">
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? tr("保存中…", "Saving…") : tr("保存", "Save")}</button>
      </div>
      {msg && <div className={`alert ${msg.kind}`}>{msg.text}</div>}
    </div>
  );
}
