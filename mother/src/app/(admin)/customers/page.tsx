import Link from "next/link";
import { listCustomers } from "@/lib/queries";
import { money, datetime } from "@/lib/format";
import { IconUsers, IconCheck, IconCoin } from "../../icons";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const customers = await listCustomers();
  const friends = customers.filter((c) => c.is_friend).length;
  const totalSpend = customers.reduce((s, c) => s + Number(c.total_spend || 0), 0);

  return (
    <>
      <div className="page-head">
        <div className="titles">
          <h1>Customers</h1>
          <p className="sub">Behavior across LINE visits, in-app orders, and Square payments.</p>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="l"><IconUsers /> Customers</div>
          <div className="n">{customers.length}</div>
        </div>
        <div className="stat">
          <div className="l"><IconCheck /> Pushable friends</div>
          <div className="n accent">{friends}</div>
        </div>
        <div className="stat">
          <div className="l"><IconCoin /> Total spend</div>
          <div className="n">{money(totalSpend)}</div>
        </div>
      </div>

      <div className="card table-card">
        <table>
          <thead>
            <tr>
              <th>Customer</th><th>Status</th><th className="num">Visits</th><th className="num">Orders</th>
              <th className="num">Spend</th><th>Tags</th><th>Last seen</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 && (
              <tr><td colSpan={7}>
                <div className="empty">
                  <IconUsers />
                  <div className="t">No customers yet</div>
                  <div>They appear after a QR check-in or a LINE follow event.</div>
                </div>
              </td></tr>
            )}
            {customers.map((c) => (
              <tr key={c.id}>
                <td className="cell-strong">
                  <Link href={`/customers/${c.id}`}>
                    {c.display_name || <span className="mono muted">{c.line_user_id?.slice(0, 14)}…</span>}
                  </Link>
                </td>
                <td>
                  <span className={`badge ${c.is_friend ? "friend" : "left"}`}>
                    {c.is_friend ? "Friend" : "Not friend"}
                  </span>
                </td>
                <td className="num">{c.visit_count}</td>
                <td className="num">{c.order_count}</td>
                <td className="num cell-strong">{money(Number(c.total_spend), c.currency || "JPY")}</td>
                <td>{c.tags?.length ? c.tags.map((t) => <span key={t} className="tag-chip">{t}</span>) : <span className="muted">—</span>}</td>
                <td className="muted">{datetime(c.last_seen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
