"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminPost } from "@/lib/admin-fetch";
import { useTr } from "../../LangProvider";

/**
 * Confirm / decline buttons for one reservation. Each opens a small dialog for
 * an optional line added to the guest's LINE message.
 */
export default function ReservationActions({ id, status }: { id: string; status: "requested" | "confirmed" }) {
  const router = useRouter();
  const tr = useTr();
  const [mode, setMode] = useState<"confirm" | "decline" | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    if (!mode) return;
    setBusy(true);
    setErr("");
    const res = await adminPost<{ notified: boolean }>("/api/admin/reservations", { action: mode, id, message });
    setBusy(false);
    if (!res.ok) return setErr(res.error ?? tr("保存できませんでした", "Could not save"));
    setMode(null);
    setMessage("");
    router.refresh();
  }

  return (
    <>
      {status === "requested" && (
        <button className="btn btn-primary btn-sm" onClick={() => setMode("confirm")}>{tr("確定", "Confirm")}</button>
      )}{" "}
      <button className="btn btn-ghost btn-sm" onClick={() => setMode("decline")}>
        {status === "requested" ? tr("お断り", "Decline") : tr("取り消す", "Cancel booking")}
      </button>

      {mode && (
        <div className="modal-backdrop" onClick={() => setMode(null)}>
          <div className="card pad modal" style={{ textAlign: "left", whiteSpace: "normal" }} onClick={(e) => e.stopPropagation()}>
            <div className="card-title">
              {mode === "confirm" ? tr("予約を確定します", "Confirm this reservation") : tr("予約をお断りします", "Decline this reservation")}
            </div>
            <p className="muted" style={{ marginTop: 0 }}>
              {mode === "confirm"
                ? tr("お客様にLINEで確定のお知らせが届きます。", "The guest gets a LINE message that the booking is confirmed.")
                : tr("お客様にLINEでお断りのお知らせが届きます。", "The guest gets a LINE message that the booking can't be accepted.")}
            </p>
            <div className="field">
              <label>{tr("お客様へのひとこと", "Message to the guest")} <span className="muted">{tr("（任意）", "(optional)")}</span></label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                style={{ minHeight: 70 }}
                placeholder={mode === "confirm"
                  ? tr("例：カウンター席をご用意しております。", "e.g. We've saved you seats at the counter.")
                  : tr("例：あいにく満席です。19:30以降でしたらご案内できます。", "e.g. We're full then, but 19:30 or later is available.")}
              />
            </div>
            {err && <div className="alert err">{err}</div>}
            <div className="form-actions">
              <button className={`btn ${mode === "confirm" ? "btn-primary" : "btn-danger"}`} onClick={submit} disabled={busy}>
                {busy ? tr("送信中…", "Sending…") : mode === "confirm" ? tr("確定して通知", "Confirm and notify") : tr("お断りして通知", "Decline and notify")}
              </button>
              <button className="btn btn-ghost" onClick={() => setMode(null)}>{tr("キャンセル", "Cancel")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
