import type { ReservationEvent } from "@/lib/reservations";
import { formatReservationTime } from "@/lib/reservations";
import { RESERVATION_EVENT } from "@/lib/reservation-labels";
import { datetime } from "@/lib/format";
import type { Tr } from "@/lib/lang";

/** Request / reply history of one reservation (server component). */
export default function ReservationHistory({ events, tr, lang }: { events: ReservationEvent[]; tr: Tr; lang: string }) {
  if (!events.length) return null;
  return (
    <ol className="resv-history">
      {events.map((e) => {
        const label = RESERVATION_EVENT[e.action];
        return (
          <li key={e.id} className={e.actor}>
            <div className="rh-head">
              <strong>{label ? tr(label.ja, label.en) : e.action}</strong>
              <span className="muted">
                {" · "}{datetime(e.created_at)}
                {e.actor === "staff" && e.staff_name ? ` · ${e.staff_name}` : ""}
              </span>
            </div>
            {e.proposed_for && <div>{tr("日時：", "Time: ")}{formatReservationTime(e.proposed_for, lang)}</div>}
            {e.message && <div className="rh-msg">{e.message}</div>}
            {e.actor === "staff" && e.notified === true && <div className="muted">{tr("お客様にLINEで送信済み", "Sent to the guest on LINE")}</div>}
            {e.actor === "staff" && e.notified === false && (
              <div style={{ color: "var(--danger)", fontSize: 12 }} title={e.notify_error ?? ""}>
                {tr("LINEで送れませんでした。お電話でご連絡ください。", "Could not send on LINE. Please call the guest.")}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
