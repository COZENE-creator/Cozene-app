import Link from "next/link";
import { notFound } from "next/navigation";
import { getCampaign } from "@/lib/push";
import { datetime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CampaignResultsPage({ params }: { params: { id: string } }) {
  const data = await getCampaign(params.id);
  if (!data) notFound();
  const { campaign, deliveries } = data;
  const total = deliveries.length;
  const sent = deliveries.filter((d) => d.status === "sent").length;
  const failed = deliveries.filter((d) => d.status === "failed").length;
  const pending = total - sent - failed;
  const pct = (n: number) => (total ? (n / total) * 100 : 0);

  const statusClass = campaign.status === "sent" ? "sent" : campaign.status === "failed" ? "failed" : "pending";

  return (
    <>
      <div className="breadcrumb"><Link href="/push">Campaigns</Link> / {campaign.title}</div>

      <div className="page-head">
        <div className="titles">
          <h1>{campaign.title}</h1>
          <p className="sub">
            Sent {datetime(campaign.sent_at)} · audience: <span style={{ textTransform: "capitalize" }}>{campaign.audience_type}</span>
          </p>
        </div>
        <div className="actions">
          <span className={`badge ${statusClass}`} style={{ textTransform: "capitalize" }}>{campaign.status}</span>
        </div>
      </div>

      <div className="two-col" style={{ marginTop: 8 }}>
        {/* Message, shown the way the customer received it */}
        <div className="card pad">
          <div className="card-title">Message</div>
          <div className="chat">
            <div className="chat-row">
              <span className="chat-av">C</span>
              <div className="chat-msg">{campaign.body}</div>
            </div>
          </div>
        </div>

        {/* Delivery summary */}
        <div className="card pad">
          <div className="card-title">Delivery</div>
          <div className="progress" role="img" aria-label={`${sent} sent, ${failed} failed of ${total}`}>
            {sent > 0 && <div className="seg-ok" style={{ width: `${pct(sent)}%` }} />}
            {failed > 0 && <div className="seg-bad" style={{ width: `${pct(failed)}%` }} />}
          </div>
          <div className="legend" style={{ marginBottom: 6 }}>
            <span><i className="swatch" style={{ background: "var(--ok)" }} /> Sent</span>
            <span><i className="swatch" style={{ background: "var(--danger)" }} /> Failed</span>
            {pending > 0 && <span><i className="swatch" style={{ background: "#dfe3e8" }} /> Pending</span>}
          </div>
          <div className="kv"><span className="k">Recipients</span><span className="v">{total}</span></div>
          <div className="kv"><span className="k">Sent</span><span className="v ok">{sent}</span></div>
          <div className="kv"><span className="k">Failed</span><span className="v bad">{failed}</span></div>
        </div>
      </div>

      <h2>Per-recipient results</h2>
      <div className="card table-card">
        <table>
          <thead><tr><th>Recipient</th><th>Status</th><th>LINE request id</th><th>Error</th><th>Sent&nbsp;at</th></tr></thead>
          <tbody>
            {deliveries.length === 0 && (
              <tr><td colSpan={5}><div className="empty"><div className="t">No recipients</div><div>The audience was empty when this campaign ran.</div></div></td></tr>
            )}
            {deliveries.map((d) => (
              <tr key={d.user_id}>
                <td className="cell-strong">{d.display_name || <span className="mono muted">{d.line_user_id.slice(0, 14)}…</span>}</td>
                <td><span className={`badge ${d.status === "sent" ? "sent" : d.status === "failed" ? "failed" : "pending"}`}>{d.status}</span></td>
                <td className="mono muted">{d.line_request_id || "—"}</td>
                <td className="muted" style={{ fontSize: 13, maxWidth: 360 }}>{d.error_message || "—"}</td>
                <td className="muted" style={{ whiteSpace: "nowrap" }}>{datetime(d.sent_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
