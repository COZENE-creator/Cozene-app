"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminPost } from "@/lib/admin-fetch";
import type { ReservationSettings } from "@/lib/reservations";
import { useTr } from "../../LangProvider";

export type StaffCandidate = { id: string; display_name: string | null; is_friend: boolean };

/** Booking hours shown in the Mini App's 予約 tab, and the staff LINE accounts that get requests. */
export default function ReservationSettingsForm({ settings, candidates }: { settings: ReservationSettings; candidates: StaffCandidate[] }) {
  const router = useRouter();
  const tr = useTr();
  const [s, setS] = useState(settings);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const nameOf = (id: string) => byId.get(id)?.display_name || tr("（名前なし）", "(no name)");

  async function test() {
    setBusy(true);
    setMsg(null);
    const res = await adminPost<{ sent: number }>("/api/admin/reservations", { action: "test_notify" });
    setBusy(false);
    if (!res.ok) return setMsg({ kind: "err", text: res.error ?? tr("送信できませんでした", "Could not send") });
    setMsg({ kind: "ok", text: tr(`テスト通知を${res.data?.sent ?? 0}件送信しました。LINEを確認してください。`, `Sent ${res.data?.sent ?? 0} test message(s). Check LINE.`) });
  }

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

      <div className="field" style={{ marginTop: 20 }}>
        <label>{tr("予約リクエストのLINE通知先", "Send new requests on LINE to")}</label>
        {s.notify_user_ids.length === 0 && <div className="muted" style={{ marginBottom: 8 }}>{tr("まだ登録されていません。", "Nobody yet.")}</div>}
        {s.notify_user_ids.map((id) => (
          <div key={id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
            <span className="cell-strong">{nameOf(id)}</span>
            {byId.get(id) && !byId.get(id)!.is_friend && (
              <span className="badge danger">{tr("友だちではないため届きません", "Not a friend — won't receive")}</span>
            )}
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setS({ ...s, notify_user_ids: s.notify_user_ids.filter((x) => x !== id) })}>
              {tr("外す", "Remove")}
            </button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <select value={pick} onChange={(e) => setPick(e.target.value)} style={{ maxWidth: 320 }}>
            <option value="">{tr("LINEアカウントを選ぶ…", "Choose a LINE account…")}</option>
            {candidates
              .filter((c) => !s.notify_user_ids.includes(c.id))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {(c.display_name || tr("（名前なし）", "(no name)")) + (c.is_friend ? "" : tr("（友だちではない）", " (not a friend)"))}
                </option>
              ))}
          </select>
          <button
            className="btn btn-secondary"
            type="button"
            disabled={!pick}
            onClick={() => {
              setS({ ...s, notify_user_ids: [...s.notify_user_ids, pick] });
              setPick("");
            }}
          >
            {tr("追加", "Add")}
          </button>
        </div>
        <div className="hint">
          {tr(
            "店長など、リクエストを受け取る方のLINEアカウントを選んでください。一覧に出てこない場合は、その方がLINE公式アカウントを友だち追加してください。通知のリンクから、スマホで確定・別の日時の提案・お断りができます。",
            "Choose the LINE accounts (e.g. the store manager) that should get requests. If someone isn't listed, have them add the official LINE account as a friend. They can confirm, suggest another time or decline from the link in the message, on their phone."
          )}
        </div>
      </div>

      <div className="form-actions">
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? tr("保存中…", "Saving…") : tr("保存", "Save")}</button>
        <button className="btn btn-secondary" type="button" onClick={test} disabled={busy || settings.notify_user_ids.length === 0}>
          {tr("テスト通知を送る", "Send a test message")}
        </button>
      </div>
      {msg && <div className={`alert ${msg.kind}`}>{msg.text}</div>}
    </div>
  );
}
