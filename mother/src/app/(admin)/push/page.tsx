import Link from "next/link";
import { listCampaigns } from "@/lib/push";
import { datetime } from "@/lib/format";
import { IconMegaphone, IconPlus } from "../../icons";
import { getTr } from "@/lib/lang-server";
import type { Tr } from "@/lib/lang";

export const dynamic = "force-dynamic";

function statusBadge(s: string) {
  if (s === "sent") return "sent";
  if (s === "failed") return "failed";
  if (s === "sending") return "warn";
  return "pending";
}

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

export default async function CampaignsPage() {
  const campaigns = await listCampaigns();
  const tr = getTr();
  return (
    <>
      <div className="page-head">
        <div className="titles">
          <h1>{tr("配信履歴", "Campaigns")}</h1>
          <p className="sub">{tr("これまでに送信したLINEメッセージと配信結果の一覧です。", "Every LINE push you've sent, with delivery outcomes.")}</p>
        </div>
        <div className="actions">
          <Link href="/push/new" className="btn btn-primary"><IconPlus /> {tr("新規配信", "New campaign")}</Link>
        </div>
      </div>

      <div className="card table-card">
        <table>
          <thead>
            <tr><th>{tr("タイトル", "Title")}</th><th>{tr("配信対象", "Audience")}</th><th>{tr("ステータス", "Status")}</th><th className="num">{tr("配信対象者", "Recipients")}</th><th className="num">{tr("送信済み", "Sent")}</th><th className="num">{tr("失敗", "Failed")}</th><th>{tr("送信日時", "Sent at")}</th></tr>
          </thead>
          <tbody>
            {campaigns.length === 0 && (
              <tr><td colSpan={7}>
                <div className="empty">
                  <IconMegaphone />
                  <div className="t">{tr("配信履歴はまだありません", "No campaigns yet")}</div>
                  <div>{tr("最初のLINEメッセージを作成して、お客様に届けましょう。", "Compose your first LINE push to reach your customers.")}</div>
                </div>
              </td></tr>
            )}
            {campaigns.map((c) => (
              <tr key={c.id}>
                <td className="cell-strong"><Link href={`/push/${c.id}`}>{c.title}</Link></td>
                <td><span className="badge neutral plain" style={{ textTransform: "capitalize" }}>{audienceLabel(c.audience_type, tr)}</span></td>
                <td><span className={`badge ${statusBadge(c.status)}`}>{statusLabel(c.status, tr)}</span></td>
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
