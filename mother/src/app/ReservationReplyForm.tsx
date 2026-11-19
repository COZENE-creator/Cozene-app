"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTr } from "./LangProvider";

type Action = "confirm" | "propose" | "decline";

/**
 * Staff reply to a reservation: confirm, suggest another time, or decline,
 * with an optional message. The guest gets it on LINE. Used in Mother's 予約
 * page and on the reply page staff open from the LINE notification.
 */
export default function ReservationReplyForm({
  endpoint,
  payload,
  status,
  times,
  defaultDate,
  initialAction,
  onDone,
}: {
  endpoint: string;
  /** Sent with every reply: {id} in Mother, {id, u, t} from the LINE link. */
  payload: Record<string, string>;
  status: string;
  /** Bookable start times for the suggestion. */
  times: string[];
  /** Pre-filled date for a suggestion (the requested day). */
  defaultDate: string;
  initialAction?: Action;
  onDone?: () => void;
}) {
  const router = useRouter();
  const tr = useTr();
  const [action, setAction] = useState<Action>(initialAction ?? (status === "confirmed" ? "propose" : "confirm"));
  const [message, setMessage] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const choices: { key: Action; label: string }[] = [
    ...(status === "confirmed" ? [] : [{ key: "confirm" as const, label: tr("確定する", "Confirm") }]),
    { key: "propose", label: tr("別の日時を提案", "Suggest another time") },
    { key: "decline", label: status === "confirmed" ? tr("予約を取り消す", "Cancel booking") : tr("お断りする", "Decline") },
  ];

  async function send() {
    setBusy(true);
    setResult(null);
    let data: { ok?: boolean; error?: string; notified?: boolean } = {};
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, action, message, ...(action === "propose" && time ? { date, time } : {}) }),
      });
      data = await res.json();
    } catch {
      data = { ok: false, error: tr("通信できませんでした", "Network error") };
    }
    setBusy(false);
    if (!data.ok) return setResult({ kind: "err", text: data.error ?? tr("送信できませんでした", "Could not send") });
    setResult(
      data.notified
        ? { kind: "ok", text: tr("お客様にLINEで送信しました。", "Sent to the guest on LINE.") }
        : { kind: "err", text: tr("保存しましたが、LINEで送れませんでした（お客様が友だちではない等）。お電話でご連絡ください。", "Saved, but the LINE message could not be sent (e.g. the guest isn't a friend). Please call the guest.") }
    );
    setMessage("");
    router.refresh();
    onDone?.();
  }

  const placeholder =
    action === "confirm"
      ? tr("例：カウンター席をご用意しております。", "e.g. We've saved you seats at the counter.")
      : action === "propose"
        ? tr("例：19:00は満席です。20:00でしたらご案内できます。", "e.g. 19:00 is full, but we can seat you at 20:00.")
        : tr("例：あいにくその日は貸切です。", "e.g. Sorry, we're booked for a private party that day.");

  return (
    <div>
      <div className="reply-choices">
        {choices.map((c) => (
          <button
            key={c.key}
            type="button"
            className={`btn btn-sm ${action === c.key ? (c.key === "decline" ? "btn-danger" : "btn-primary") : "btn-secondary"}`}
            onClick={() => setAction(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {action === "propose" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="field">
            <label>{tr("提案する日付", "Suggested date")}</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label>{tr("提案する時間", "Suggested time")}</label>
            <select value={time} onChange={(e) => setTime(e.target.value)}>
              <option value="">{tr("（メッセージのみ）", "(message only)")}</option>
              {times.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      )}
      {action === "propose" && (
        <div className="hint" style={{ marginTop: -8, marginBottom: 12 }}>
          {tr("時間を選ぶと、お客様はミニアプリからワンタップでその日時に予約できます。", "If you pick a time, the guest can book it with one tap in the Mini App.")}
        </div>
      )}

      <div className="field">
        <label>
          {tr("お客様へのメッセージ", "Message to the guest")}{" "}
          <span className="muted">{action === "propose" && !time ? tr("（必須）", "(required)") : tr("（任意）", "(optional)")}</span>
        </label>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} style={{ minHeight: 80 }} placeholder={placeholder} />
      </div>

      <div className="form-actions" style={{ marginTop: 8 }}>
        <button className={`btn ${action === "decline" ? "btn-danger" : "btn-primary"}`} onClick={send} disabled={busy} style={{ minWidth: 160 }}>
          {busy ? tr("送信中…", "Sending…") : tr("LINEで送信", "Send on LINE")}
        </button>
      </div>
      {result && <div className={`alert ${result.kind}`}>{result.text}</div>}
    </div>
  );
}
