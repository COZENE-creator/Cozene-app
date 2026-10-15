import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomer, getCustomerTimeline, getUserTagIds, listTags, getCustomerMiniApp } from "@/lib/queries";
import { money, datetime } from "@/lib/format";
import TagAssign from "./TagAssign";

export const dynamic = "force-dynamic";

const KIND_BADGE: Record<string, string> = { visit: "neutral", order: "warn", payment: "ok" };

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const customer = await getCustomer(params.id);
  if (!customer) notFound();
  const [timeline, allTags, assigned, miniapp] = await Promise.all([
    getCustomerTimeline(params.id),
    listTags(),
    getUserTagIds(params.id),
    getCustomerMiniApp(params.id),
  ]);

  return (
    <>
      <div className="breadcrumb"><Link href="/customers">Customers</Link> / {customer.display_name || "Unknown"}</div>

      <div className="page-head">
        <div className="titles">
          <h1>{customer.display_name || "Unknown customer"}</h1>
          <p className="sub">
            <span className={`badge ${customer.is_friend ? "friend" : "left"}`}>
              {customer.is_friend ? "Friend" : "Not friend"}
            </span>
            {" · "}<span className="mono">{customer.line_user_id || "—"}</span>
            {" · followed "}{datetime(customer.followed_at)}
          </p>
        </div>
      </div>

      <h2>Mini App</h2>
      <div className="card pad">
        <div className="kv">
          <span className="muted">Data use (this store)</span>
          <ConsentBadge value={miniapp.store_use} />
        </div>
        <div className="kv">
          <span className="muted">Share with partner stores</span>
          <ConsentBadge value={miniapp.partner_sharing} optional />
        </div>
        <div className="kv">
          <span className="muted">Last answered</span>
          <span>{miniapp.consent_at ? `${datetime(miniapp.consent_at)} · policy ${miniapp.policy_version}` : "—"}</span>
        </div>
        <div className="kv" style={{ borderBottom: 0 }}>
          <span className="muted">Benefits used</span>
          <span>
            {miniapp.benefits.length === 0
              ? "None"
              : miniapp.benefits.map((b) => `${b.title} (${datetime(b.redeemed_at)})`).join(", ")}
          </span>
        </div>
      </div>

      <h2>Tags</h2>
      <div className="card pad">
        <TagAssign
          userId={customer.id}
          allTags={allTags.map((t) => ({ id: t.id, label: t.label }))}
          assigned={assigned}
        />
      </div>

      <h2>Activity</h2>
      <div className="card table-card">
        <table>
          <thead><tr><th>When</th><th>Event</th><th>Detail</th><th className="num">Amount</th></tr></thead>
          <tbody>
            {timeline.length === 0 && (
              <tr><td colSpan={4}><div className="empty"><div className="t">No activity yet</div></div></td></tr>
            )}
            {timeline.map((e, i) => (
              <tr key={i}>
                <td className="muted">{datetime(e.at)}</td>
                <td><span className={`badge ${KIND_BADGE[e.kind] || "neutral"}`} style={{ textTransform: "capitalize" }}>{e.kind}</span></td>
                <td>{e.detail}</td>
                <td className="num">{e.amount != null ? money(Number(e.amount)) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ConsentBadge({ value, optional }: { value: boolean | null; optional?: boolean }) {
  if (value === null) return <span className="badge neutral">Not asked</span>;
  if (value) return <span className="badge ok">Agreed</span>;
  // Declining an optional scope is normal, not a warning.
  return <span className={`badge ${optional ? "neutral" : "danger"}`}>{optional ? "Off" : "Declined"}</span>;
}
