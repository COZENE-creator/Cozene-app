import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomer, getCustomerTimeline, getUserTagIds, listTags, getCustomerMiniApp } from "@/lib/queries";
import { money, datetime } from "@/lib/format";
import TagAssign from "./TagAssign";
import { getTr, getLang } from "@/lib/lang-server";
import { listCustomerReservations, formatReservationTime } from "@/lib/reservations";
import { RESERVATION_STATUS } from "@/lib/reservation-labels";
import ReservationHistory from "../../../ReservationHistory";
import type { Tr } from "@/lib/lang";

export const dynamic = "force-dynamic";

const KIND_BADGE: Record<string, string> = { visit: "neutral", order: "warn", payment: "ok" };
const KIND_LABEL: Record<string, { ja: string; en: string }> = {
  visit: { ja: "来店", en: "Visit" },
  order: { ja: "注文", en: "Order" },
  payment: { ja: "決済", en: "Payment" },
};

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const tr = getTr();
  const lang = getLang();
  const customer = await getCustomer(params.id);
  if (!customer) notFound();
  const [timeline, allTags, assigned, miniapp, reservations] = await Promise.all([
    getCustomerTimeline(params.id),
    listTags(),
    getUserTagIds(params.id),
    getCustomerMiniApp(params.id),
    listCustomerReservations(params.id),
  ]);

  return (
    <>
      <div className="breadcrumb"><Link href="/customers">{tr("顧客", "Customers")}</Link> / {customer.display_name || tr("不明", "Unknown")}</div>

      <div className="page-head">
        <div className="titles">
          <h1>{customer.display_name || tr("不明な顧客", "Unknown customer")}</h1>
          <p className="sub">
            <span className={`badge ${customer.is_friend ? "friend" : "left"}`}>
              {customer.is_friend ? tr("友だち", "Friend") : tr("友だちではない", "Not friend")}
            </span>
            {" · "}<span className="mono">{customer.line_user_id || "—"}</span>
            {tr(" · 友だち追加 ", " · followed ")}{datetime(customer.followed_at)}
          </p>
        </div>
      </div>

      <h2>{tr("ミニアプリ", "Mini App")}</h2>
      <div className="card pad">
        <div className="kv">
          <span className="muted">{tr("データ利用（この店舗）", "Data use (this store)")}</span>
          <ConsentBadge value={miniapp.store_use} tr={tr} />
        </div>
        <div className="kv">
          <span className="muted">{tr("提携店舗との共有", "Share with partner stores")}</span>
          <ConsentBadge value={miniapp.partner_sharing} optional tr={tr} />
        </div>
        <div className="kv">
          <span className="muted">{tr("最終回答日時", "Last answered")}</span>
          <span>{miniapp.consent_at ? tr(`${datetime(miniapp.consent_at)} · ポリシー ${miniapp.policy_version}`, `${datetime(miniapp.consent_at)} · policy ${miniapp.policy_version}`) : "—"}</span>
        </div>
        <div className="kv" style={{ borderBottom: 0 }}>
          <span className="muted">{tr("利用済みの特典", "Benefits used")}</span>
          <span>
            {miniapp.benefits.length === 0
              ? tr("なし", "None")
              : miniapp.benefits.map((b) => `${b.title} (${datetime(b.redeemed_at)})`).join(", ")}
          </span>
        </div>
      </div>

      <h2>{tr("予約", "Reservations")}</h2>
      <div className="card table-card">
        <table>
          <thead><tr><th>{tr("日時", "When")}</th><th className="num">{tr("人数", "Party")}</th><th>{tr("ステータス・やり取り", "Status & messages")}</th></tr></thead>
          <tbody>
            {reservations.length === 0 && (
              <tr><td colSpan={3}><div className="empty"><div className="t">{tr("予約はありません", "No reservations")}</div></div></td></tr>
            )}
            {reservations.map((r) => {
              const st = RESERVATION_STATUS[r.status];
              return (
                <tr key={r.id}>
                  <td className="cell-strong" style={{ whiteSpace: "nowrap", verticalAlign: "top" }}>{formatReservationTime(r.reserved_for, lang)}</td>
                  <td className="num" style={{ verticalAlign: "top" }}>{tr(`${r.party_size}名`, String(r.party_size))}</td>
                  <td>
                    <span className={`badge ${st?.badge ?? "neutral"}`}>{st ? tr(st.ja, st.en) : r.status}</span>
                    <ReservationHistory events={r.events} tr={tr} lang={lang} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>{tr("タグ", "Tags")}</h2>
      <div className="card pad">
        <TagAssign
          userId={customer.id}
          allTags={allTags.map((t) => ({ id: t.id, label: t.label }))}
          assigned={assigned}
        />
      </div>

      <h2>{tr("履歴", "Activity")}</h2>
      <div className="card table-card">
        <table>
          <thead><tr><th>{tr("日時", "When")}</th><th>{tr("イベント", "Event")}</th><th>{tr("詳細", "Detail")}</th><th className="num">{tr("金額", "Amount")}</th></tr></thead>
          <tbody>
            {timeline.length === 0 && (
              <tr><td colSpan={4}><div className="empty"><div className="t">{tr("まだ履歴はありません", "No activity yet")}</div></div></td></tr>
            )}
            {timeline.map((e, i) => (
              <tr key={i}>
                <td className="muted">{datetime(e.at)}</td>
                <td><span className={`badge ${KIND_BADGE[e.kind] || "neutral"}`} style={{ textTransform: "capitalize" }}>{KIND_LABEL[e.kind] ? tr(KIND_LABEL[e.kind].ja, KIND_LABEL[e.kind].en) : e.kind}</span></td>
                <td>
                  {[
                    e.detail,
                    e.table_no ? tr(`テーブル ${e.table_no}`, `Table ${e.table_no}`) : null,
                    e.party_size ? tr(`${e.party_size}名`, `${e.party_size} ${e.party_size === 1 ? "guest" : "guests"}`) : null,
                  ].filter(Boolean).join(" · ")}
                </td>
                <td className="num">{e.amount != null ? money(Number(e.amount)) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ConsentBadge({ value, optional, tr }: { value: boolean | null; optional?: boolean; tr: Tr }) {
  if (value === null) return <span className="badge neutral">{tr("未回答", "Not asked")}</span>;
  if (value) return <span className="badge ok">{tr("同意済み", "Agreed")}</span>;
  // Declining an optional scope is normal, not a warning.
  return <span className={`badge ${optional ? "neutral" : "danger"}`}>{optional ? tr("オフ", "Off") : tr("同意しない", "Declined")}</span>;
}
