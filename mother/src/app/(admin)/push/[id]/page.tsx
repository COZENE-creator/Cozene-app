import Link from "next/link";
import { notFound } from "next/navigation";
import { getCampaign } from "@/lib/push";
import { datetime } from "@/lib/format";
import { getTr } from "@/lib/lang-server";
import type { Tr } from "@/lib/lang";

export const dynamic = "force-dynamic";

function statusLabel(s: string, tr: Tr) {
  if (s === "sent") return tr("送信済み", "sent");
  if (s === "failed") return tr("失敗", "failed");
  if (s === "sending") return tr("送信中", "sending");
  if (s === "pending") return tr("送信待ち", "pending");
  if (s === "draft") return tr("下書き", "draft");
  return s;
}

function audienceLabel(a: string, tr: Tr) {
  if (a === "all") return tr("すべての友だち", "all");
  if (a === "tag") return tr("タグ", "tag");
  if (a === "segment") return tr("セグメント", "segment");
  if (a === "rating") return tr("おすすめの評価", "rating");
  return a;
}

export default async function CampaignResultsPage({ params }: { params: { id: string } }) {
  const data = await getCampaign(params.id);
  if (!data) notFound();
  const { campaign, deliveries } = data;
  const tr = getTr();
  const total = deliveries.length;
  const sent = deliveries.filter((d) => d.status === "sent").length;
  const failed = deliveries.filter((d) => d.status === "failed").length;
  const pending = total - sent - failed;
  const pct = (n: number) => (total ? (n / total) * 100 : 0);

  const statusClass = campaign.status === "sent" ? "sent" : campaign.status === "failed" ? "failed" : "pending";

  return (
    <>
      <div className="breadcrumb"><Link href="/push">{tr("配信履歴", "Campaigns")}</Link> / {campaign.title}</div>

      <div className="page-head">
        <div className="titles">
          <h1>{campaign.title}</h1>
          <p className="sub">
            {tr("送信日時", "Sent")} {datetime(campaign.sent_at)} · {tr("配信対象", "audience")}: <span style={{ textTransform: "capitalize" }}>{audienceLabel(campaign.audience_type, tr)}</span>
          </p>
        </div>
        <div className="actions">
          <span className={`badge ${statusClass}`} style={{ textTransform: "capitalize" }}>{statusLabel(campaign.status, tr)}</span>
        </div>
      </div>

      <div className="two-col" style={{ marginTop: 8 }}>
        {/* Message, shown the way the customer received it */}
        <div className="card pad">
          <div className="card-title">{tr("メッセージ", "Message")}</div>
          <div className="chat">
            <div className="chat-row">
              <span className="chat-av">C</span>
              <div className="chat-msg">{campaign.body}</div>
            </div>
          </div>
        </div>

        {/* Delivery summary */}
        <div className="card pad">
          <div className="card-title">{tr("配信結果", "Delivery")}</div>
          <div className="progress" role="img" aria-label={tr(`${total}件中 送信済み${sent}件・失敗${failed}件`, `${sent} sent, ${failed} failed of ${total}`)}>
            {sent > 0 && <div className="seg-ok" style={{ width: `${pct(sent)}%` }} />}
            {failed > 0 && <div className="seg-bad" style={{ width: `${pct(failed)}%` }} />}
          </div>
          <div className="legend" style={{ marginBottom: 6 }}>
            <span><i className="swatch" style={{ background: "var(--ok)" }} /> {tr("送信済み", "Sent")}</span>
            <span><i className="swatch" style={{ background: "var(--danger)" }} /> {tr("失敗", "Failed")}</span>
            {pending > 0 && <span><i className="swatch" style={{ background: "#dfe3e8" }} /> {tr("送信待ち", "Pending")}</span>}
          </div>
          <div className="kv"><span className="k">{tr("配信対象者", "Recipients")}</span><span className="v">{total}</span></div>
          <div className="kv"><span className="k">{tr("送信済み", "Sent")}</span><span className="v ok">{sent}</span></div>
          <div className="kv"><span className="k">{tr("失敗", "Failed")}</span><span className="v bad">{failed}</span></div>
        </div>
      </div>

      <h2>{tr("宛先ごとの結果", "Per-recipient results")}</h2>
      <div className="card table-card">
        <table>
          <thead><tr><th>{tr("宛先", "Recipient")}</th><th>{tr("ステータス", "Status")}</th><th>{tr("LINEリクエストID", "LINE request id")}</th><th>{tr("エラー", "Error")}</th><th>{tr("送信日時", "Sent\u00a0at")}</th></tr></thead>
          <tbody>
            {deliveries.length === 0 && (
              <tr><td colSpan={5}><div className="empty"><div className="t">{tr("宛先がありません", "No recipients")}</div><div>{tr("この配信の実行時、配信対象者は0人でした。", "The audience was empty when this campaign ran.")}</div></div></td></tr>
            )}
            {deliveries.map((d) => (
              <tr key={d.user_id}>
                <td className="cell-strong">{d.display_name || <span className="mono muted">{d.line_user_id.slice(0, 14)}…</span>}</td>
                <td><span className={`badge ${d.status === "sent" ? "sent" : d.status === "failed" ? "failed" : "pending"}`}>{statusLabel(d.status, tr)}</span></td>
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
