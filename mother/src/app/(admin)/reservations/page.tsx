import Link from "next/link";
import { adminStoreId } from "@/lib/store-admin";
import { listReservations, getReservationSettings, formatReservationTime } from "@/lib/reservations";
import { getTr, getLang } from "@/lib/lang-server";
import ReservationActions from "./ReservationActions";
import ReservationSettingsForm from "./ReservationSettingsForm";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { ja: string; en: string; badge: string }> = {
  requested: { ja: "リクエスト", en: "Requested", badge: "pending" },
  confirmed: { ja: "確定", en: "Confirmed", badge: "ok" },
  declined: { ja: "お断り", en: "Declined", badge: "danger" },
  cancelled: { ja: "キャンセル", en: "Cancelled", badge: "neutral" },
};

export default async function ReservationsPage({ searchParams }: { searchParams: { when?: string } }) {
  const tr = getTr();
  const lang = getLang();
  const when = searchParams.when === "past" ? "past" : "upcoming";
  const storeId = await adminStoreId();
  if (!storeId) {
    return <div className="card"><div className="empty"><div className="t">{tr("店舗が設定されていません", "No store configured")}</div></div></div>;
  }
  const [rows, settings] = await Promise.all([listReservations(storeId, when), getReservationSettings(storeId)]);

  return (
    <>
      <div className="page-head">
        <div className="titles">
          <h1>{tr("予約", "Reservations")}</h1>
          <p className="sub">{tr(
            "ミニアプリの「予約」タブから届いたリクエストです。確定またはお断りすると、お客様にLINEでお知らせが届きます（公式アカウントの友だちの場合）。",
            "Requests from the Mini App's Reservation tab. When you confirm or decline, the guest gets a LINE message (if they are a friend of the official account)."
          )}</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <Link href="/reservations" className={`btn btn-sm ${when === "upcoming" ? "btn-primary" : "btn-secondary"}`}>{tr("今日以降", "Upcoming")}</Link>
        <Link href="/reservations?when=past" className={`btn btn-sm ${when === "past" ? "btn-primary" : "btn-secondary"}`}>{tr("過去", "Past")}</Link>
      </div>

      <div className="card table-card">
        <table>
          <thead>
            <tr>
              <th>{tr("日時", "When")}</th>
              <th className="num">{tr("人数", "Party")}</th>
              <th>{tr("お名前・連絡先", "Name & contact")}</th>
              <th>{tr("ご要望", "Note")}</th>
              <th>{tr("ステータス", "Status")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <div className="empty">
                    <div className="t">{when === "upcoming" ? tr("今後の予約はありません", "No upcoming reservations") : tr("過去の予約はありません", "No past reservations")}</div>
                  </div>
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const st = STATUS[r.status];
              return (
                <tr key={r.id} style={r.status === "cancelled" || r.status === "declined" ? { opacity: 0.6 } : undefined}>
                  <td className="cell-strong" style={{ whiteSpace: "nowrap" }}>{formatReservationTime(r.reserved_for, lang)}</td>
                  <td className="num">{tr(`${r.party_size}名`, `${r.party_size}`)}</td>
                  <td>
                    <div className="cell-strong">
                      {r.user_id ? <a href={`/customers/${r.user_id}`}>{r.name}</a> : r.name}
                    </div>
                    {r.phone && <div className="muted"><a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`}>{r.phone}</a></div>}
                    <div className="muted">
                      {r.display_name && r.display_name !== r.name ? `LINE: ${r.display_name} · ` : ""}
                      {r.lang === "en" ? tr("英語でのご案内", "Replies in English") : tr("日本語でのご案内", "Replies in Japanese")}
                    </div>
                  </td>
                  <td style={{ maxWidth: 260, whiteSpace: "pre-wrap" }}>{r.note ?? <span className="muted">—</span>}</td>
                  <td>
                    <span className={`badge ${st?.badge ?? "neutral"}`}>{st ? tr(st.ja, st.en) : r.status}</span>
                    {r.notified === true && <div className="muted" style={{ fontSize: 12 }}>{tr("LINEで通知済み", "LINE message sent")}</div>}
                    {r.notified === false && (
                      <div style={{ fontSize: 12, color: "var(--danger)" }} title={r.notify_error ?? ""}>
                        {r.is_friend === false
                          ? tr("LINE未送信（友だちではありません）。お電話でご連絡ください。", "No LINE message (not a friend). Please call the guest.")
                          : tr("LINE未送信。お電話でご連絡ください。", "LINE message failed. Please call the guest.")}
                      </div>
                    )}
                    {r.staff_message && <div className="muted" style={{ fontSize: 12 }}>「{r.staff_message}」</div>}
                  </td>
                  <td className="num" style={{ whiteSpace: "nowrap" }}>
                    {when === "upcoming" && (r.status === "requested" || r.status === "confirmed") && (
                      <ReservationActions id={r.id} status={r.status} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>{tr("予約の受付設定", "Booking hours")}</h2>
      <div className="card pad">
        <ReservationSettingsForm settings={settings} />
      </div>
    </>
  );
}
