import Link from "next/link";
import { listCampaigns } from "@/lib/push";
import { datetime } from "@/lib/format";
import { IconMegaphone, IconPlus } from "../../icons";

export const dynamic = "force-dynamic";

function statusBadge(s: string) {
  if (s === "sent") return "sent";
  if (s === "failed") return "failed";
  if (s === "sending") return "warn";
  return "pending";
}

export default async function CampaignsPage() {
  const campaigns = await listCampaigns();
  return (
    <>
      <div className="page-head">
        <div className="titles">
          <h1>Campaigns</h1>
          <p className="sub">Every LINE push you&apos;ve sent, with delivery outcomes.</p>
        </div>
        <div className="actions">
          <Link href="/push/new" className="btn btn-primary"><IconPlus /> New campaign</Link>
        </div>
      </div>

      <div className="card table-card">
        <table>
          <thead>
            <tr><th>Title</th><th>Audience</th><th>Status</th><th className="num">Recipients</th><th className="num">Sent</th><th className="num">Failed</th><th>Sent at</th></tr>
          </thead>
          <tbody>
            {campaigns.length === 0 && (
              <tr><td colSpan={7}>
                <div className="empty">
                  <IconMegaphone />
                  <div className="t">No campaigns yet</div>
                  <div>Compose your first LINE push to reach your customers.</div>
                </div>
              </td></tr>
            )}
            {campaigns.map((c) => (
              <tr key={c.id}>
                <td className="cell-strong"><Link href={`/push/${c.id}`}>{c.title}</Link></td>
                <td><span className="badge neutral plain" style={{ textTransform: "capitalize" }}>{c.audience_type}</span></td>
                <td><span className={`badge ${statusBadge(c.status)}`}>{c.status}</span></td>
                <td className="num">{c.recipients}</td>
                <td className="num" style={{ color: "var(--ok)" }}>{c.sent}</td>
                <td className="num" style={{ color: c.failed ? "var(--danger)" : "inherit" }}>{c.failed}</td>
                <td className="muted">{datetime(c.sent_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
