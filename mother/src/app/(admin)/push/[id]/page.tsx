import Link from "next/link";
import { notFound } from "next/navigation";
import { getCampaign } from "@/lib/push";
import { datetime } from "@/lib/format";
import { IconUsers, IconCheck } from "../../../icons";

export const dynamic = "force-dynamic";

export default async function CampaignResultsPage({ params }: { params: { id: string } }) {
  const data = await getCampaign(params.id);
  if (!data) notFound();
  const { campaign, deliveries } = data;
  const sent = deliveries.filter((d) => d.status === "sent").length;
  const failed = deliveries.filter((d) => d.status === "failed").length;

  return (
    <>
      <div className="breadcrumb"><Link href="/push">Campaigns</Link> / {campaign.title}</div>

      <div className="page-head">
        <div className="titles">
          <h1>{campaign.title}</h1>
          <p className="sub">
            Sent {datetime(campaign.sent_at)} · audience:{" "}
            <span style={{ textTransform: "capitalize" }}>{campaign.audience_type}</span>
          </p>
        </div>
      </div>

      <div className="card pad">
        <div className="card-title">Message</div>
        <div className="pre">{campaign.body}</div>
      </div>

      <div className="stat-grid">
        <div className="stat"><div className="l"><IconUsers /> Recipients</div><div className="n">{deliveries.length}</div></div>
        <div className="stat"><div className="l"><IconCheck /> Sent</div><div className="n" style={{ color: "var(--ok)" }}>{sent}</div></div>
        <div className="stat"><div className="l">Failed</div><div className="n" style={{ color: failed ? "var(--danger)" : "inherit" }}>{failed}</div></div>
      </div>

      <h2>Per-recipient results</h2>
      <div className="card table-card">
        <table>
          <thead><tr><th>Recipient</th><th>Status</th><th>LINE request id</th><th>Error</th><th>Sent at</th></tr></thead>
          <tbody>
            {deliveries.length === 0 && (
              <tr><td colSpan={5}><div className="empty"><div className="t">No recipients</div><div>The audience was empty when this campaign ran.</div></div></td></tr>
            )}
            {deliveries.map((d) => (
              <tr key={d.user_id}>
                <td className="cell-strong">{d.display_name || <span className="mono muted">{d.line_user_id.slice(0, 14)}…</span>}</td>
                <td><span className={`badge ${d.status === "sent" ? "sent" : d.status === "failed" ? "failed" : "pending"}`}>{d.status}</span></td>
                <td className="mono muted">{d.line_request_id || "—"}</td>
                <td style={{ color: "var(--danger)", fontSize: 13 }}>{d.error_message || ""}</td>
                <td className="muted">{datetime(d.sent_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
