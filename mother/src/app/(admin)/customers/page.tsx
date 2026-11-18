import Link from "next/link";
import { listCustomers } from "@/lib/queries";
import { money, datetime } from "@/lib/format";
import { IconUsers, IconCheck, IconCoin } from "../../icons";
import { getTr } from "@/lib/lang-server";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const tr = getTr();
  const customers = await listCustomers();
  const friends = customers.filter((c) => c.is_friend).length;
  const totalSpend = customers.reduce((s, c) => s + Number(c.total_spend || 0), 0);

  return (
    <>
      <div className="page-head">
        <div className="titles">
          <h1>{tr("顧客", "Customers")}</h1>
          <p className="sub">{tr("LINEでの来店・アプリ内注文・Square決済をまとめた顧客の行動データです。", "Behavior across LINE visits, in-app orders, and Square payments.")}</p>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="l"><IconUsers /> {tr("顧客", "Customers")}</div>
          <div className="n">{customers.length}</div>
        </div>
        <div className="stat">
          <div className="l"><IconCheck /> {tr("配信可能な友だち", "Pushable friends")}</div>
          <div className="n accent">{friends}</div>
        </div>
        <div className="stat">
          <div className="l"><IconCoin /> {tr("累計利用金額", "Total spend")}</div>
          <div className="n">{money(totalSpend)}</div>
        </div>
      </div>

      <div className="card table-card">
        <table>
          <thead>
            <tr>
              <th>{tr("顧客", "Customer")}</th><th>{tr("ステータス", "Status")}</th><th className="num">{tr("来店回数", "Visits")}</th><th className="num">{tr("注文", "Orders")}</th>
              <th className="num">{tr("利用金額", "Spend")}</th><th>{tr("タグ", "Tags")}</th><th>{tr("最終来店", "Last seen")}</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 && (
              <tr><td colSpan={7}>
                <div className="empty">
                  <IconUsers />
                  <div className="t">{tr("まだ顧客はいません", "No customers yet")}</div>
                  <div>{tr("QRチェックインまたはLINEの友だち追加後に表示されます。", "They appear after a QR check-in or a LINE follow event.")}</div>
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
                    {c.is_friend ? tr("友だち", "Friend") : tr("友だちではない", "Not friend")}
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
