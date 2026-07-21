import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomer, getCustomerTimeline, getUserTagIds, listTags } from "@/lib/queries";
import { money, datetime } from "@/lib/format";
import TagAssign from "./TagAssign";

export const dynamic = "force-dynamic";

const KIND_BADGE: Record<string, string> = { visit: "neutral", order: "warn", payment: "ok" };

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const customer = await getCustomer(params.id);
  if (!customer) notFound();
  const [timeline, allTags, assigned] = await Promise.all([
    getCustomerTimeline(params.id),
    listTags(),
    getUserTagIds(params.id),
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
