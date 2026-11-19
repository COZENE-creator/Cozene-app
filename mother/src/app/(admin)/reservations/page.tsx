import Link from "next/link";
import { query } from "@/lib/db";
import { adminStoreId } from "@/lib/store-admin";
import { listReservations, getReservationSettings, getCalendar, timeSlots, formatReservationTime } from "@/lib/reservations";
import { getBusinessHours } from "@/lib/business-hours";
import { RESERVATION_STATUS } from "@/lib/reservation-labels";
import { getTr, getLang } from "@/lib/lang-server";
import ReservationActions from "./ReservationActions";
import ReservationSettingsForm, { type StaffCandidate } from "./ReservationSettingsForm";
import AvailabilityCalendar from "./AvailabilityCalendar";
import ReservationHistory from "../../ReservationHistory";

export const dynamic = "force-dynamic";

const japanDay = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date(iso));

export default async function ReservationsPage({ searchParams }: { searchParams: { when?: string } }) {
  const tr = getTr();
  const lang = getLang();
  const when = searchParams.when === "past" ? "past" : "upcoming";
  const storeId = await adminStoreId();
  if (!storeId) {
    return <div className="card"><div className="empty"><div className="t">{tr("店舗が設定されていません", "No store configured")}</div></div></div>;
  }
  const [rows, settings, hours, candidates] = await Promise.all([
    listReservations(storeId, when),
    getReservationSettings(storeId),
    getBusinessHours(storeId),
    query<StaffCandidate>(
      `SELECT id, display_name, is_friend FROM users
        WHERE store_id = $1 AND line_user_id IS NOT NULL
        ORDER BY is_friend DESC, display_name NULLS LAST LIMIT 1000`,
      [storeId]
    ),
  ]);
  const calendar = await getCalendar(storeId, settings, hours);
  const times = timeSlots(settings);

  // Open requests and bookings per day, for the calendar.
  const upcoming = when === "upcoming" ? rows : await listReservations(storeId, "upcoming");
  const perDay: Record<string, number> = {};
  for (const r of upcoming) {
    if (r.status === "declined" || r.status === "cancelled") continue;
    const d = japanDay(r.reserved_for);
    perDay[d] = (perDay[d] ?? 0) + 1;
  }

  return (
    <>
      <div className="page-head">
        <div className="titles">
          <h1>{tr("予約", "Reservations")}</h1>
          <p className="sub">{tr(
            "ミニアプリの「予約」タブから届いたリクエストです。確定・別の日時の提案・お断りをすると、お客様にLINEでお知らせが届きます（公式アカウントの友だちの場合）。やり取りはすべて履歴に残り、顧客ページにも表示されます。",
            "Requests from the Mini App's Reservation tab. When you confirm, suggest another time or decline, the guest gets a LINE message (if they are a friend of the official account). Every step is kept in the history and shown on the customer's page."
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
              <th>{tr("ステータス・履歴", "Status & history")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <div className="empty">
                    <div className="t">{when === "upcoming" ? tr("今後の予約はありません", "No upcoming reservations") : tr("過去の予約はありません", "No past reservations")}</div>
                  </div>
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const st = RESERVATION_STATUS[r.status];
              const open = r.status === "requested" || r.status === "proposed" || r.status === "confirmed";
              return (
                <tr key={r.id} style={r.status === "cancelled" || r.status === "declined" ? { opacity: 0.6 } : undefined}>
                  <td className="cell-strong" style={{ whiteSpace: "nowrap", verticalAlign: "top" }}>{formatReservationTime(r.reserved_for, lang)}</td>
                  <td className="num" style={{ verticalAlign: "top" }}>{tr(`${r.party_size}名`, `${r.party_size}`)}</td>
                  <td style={{ verticalAlign: "top" }}>
                    <div className="cell-strong">
                      {r.user_id ? <a href={`/customers/${r.user_id}`}>{r.name}</a> : r.name}
                    </div>
                    {r.phone && <div className="muted"><a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`}>{r.phone}</a></div>}
                    <div className="muted">
                      {r.display_name && r.display_name !== r.name ? `LINE: ${r.display_name} · ` : ""}
                      {r.lang === "en" ? tr("英語でのご案内", "Replies in English") : tr("日本語でのご案内", "Replies in Japanese")}
                    </div>
                    {r.is_friend === false && <div style={{ fontSize: 12, color: "var(--danger)" }}>{tr("友だちではないためLINEが届きません", "Not a friend: LINE messages won't arrive")}</div>}
                  </td>
                  <td style={{ minWidth: 260, verticalAlign: "top" }}>
                    <span className={`badge ${st?.badge ?? "neutral"}`}>{st ? tr(st.ja, st.en) : r.status}</span>
                    {r.status === "proposed" && r.proposed_for && (
                      <span className="muted"> {formatReservationTime(r.proposed_for, lang)}</span>
                    )}
                    <details>
                      <summary className="muted" style={{ cursor: "pointer", marginTop: 6 }}>{tr(`履歴（${r.events.length}件）`, `History (${r.events.length})`)}</summary>
                      <ReservationHistory events={r.events} tr={tr} lang={lang} />
                    </details>
                  </td>
                  <td className="num" style={{ whiteSpace: "nowrap", verticalAlign: "top" }}>
                    {when === "upcoming" && open && (
                      <ReservationActions id={r.id} status={r.status as "requested" | "proposed" | "confirmed"} times={times} requestedDay={japanDay(r.reserved_for)} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>{tr("空き状況カレンダー", "Availability calendar")}</h2>
      <div className="card pad">
        <AvailabilityCalendar days={calendar} requests={perDay} closedDays={hours.closed_days} />
      </div>

      <h2>{tr("予約の受付設定", "Booking settings")}</h2>
      <div className="card pad">
        <ReservationSettingsForm settings={settings} candidates={candidates} />
      </div>
    </>
  );
}
