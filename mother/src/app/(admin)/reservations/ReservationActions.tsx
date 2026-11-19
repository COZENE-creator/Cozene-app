"use client";

import { useState } from "react";
import { useTr } from "../../LangProvider";
import ReservationReplyForm from "../../ReservationReplyForm";

/**
 * Reply buttons for one reservation. Each opens a dialog with the reply form
 * (confirm / suggest another time / decline + a message for the guest's LINE).
 */
export default function ReservationActions({
  id,
  status,
  times,
  requestedDay,
}: {
  id: string;
  status: "requested" | "proposed" | "confirmed";
  times: string[];
  requestedDay: string;
}) {
  const tr = useTr();
  const [mode, setMode] = useState<"confirm" | "propose" | "decline" | null>(null);

  return (
    <>
      {status !== "confirmed" && (
        <button className="btn btn-primary btn-sm" onClick={() => setMode("confirm")}>{tr("確定", "Confirm")}</button>
      )}{" "}
      <button className="btn btn-secondary btn-sm" onClick={() => setMode("propose")}>{tr("別の日時", "Other time")}</button>{" "}
      <button className="btn btn-ghost btn-sm" onClick={() => setMode("decline")}>
        {status === "confirmed" ? tr("取り消す", "Cancel booking") : tr("お断り", "Decline")}
      </button>

      {mode && (
        <div className="modal-backdrop" onClick={() => setMode(null)}>
          <div className="card pad modal" style={{ textAlign: "left", whiteSpace: "normal" }} onClick={(e) => e.stopPropagation()}>
            <div className="card-title">{tr("お客様に返信", "Reply to the guest")}</div>
            <p className="muted" style={{ marginTop: 0 }}>
              {tr("お客様にLINEでお知らせが届きます（公式アカウントの友だちの場合）。", "The guest gets a LINE message (if they are a friend of the official account).")}
            </p>
            <ReservationReplyForm
              endpoint="/api/admin/reservations"
              payload={{ id }}
              status={status}
              times={times}
              defaultDate={requestedDay}
              initialAction={mode}
              onDone={() => setMode(null)}
            />
            <div className="form-actions" style={{ marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={() => setMode(null)}>{tr("閉じる", "Close")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
