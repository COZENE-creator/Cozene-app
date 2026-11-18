import { guardApi, currentAdmin } from "@/lib/auth-server";
import { resolveStoreForLine } from "@/lib/stores";
import { ok, fail, readJsonBody } from "@/lib/http";
import { sendCampaignNow } from "@/lib/push";
import { getTr } from "@/lib/lang-server";
import { resolveAudience, type AudienceType, type AudienceSpec } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  title?: string;
  body?: string;
  audience_type?: AudienceType;
  audience_spec?: AudienceSpec;
  /** Resolve the audience and return the count without sending anything. */
  dry_run?: boolean;
};

export async function POST(req: Request) {
  const unauth = guardApi();
  if (unauth) return unauth;
  const tr = getTr();

  let payload: Body;
  try {
    payload = await readJsonBody<Body>(req);
  } catch {
    return fail(tr("リクエストの形式が正しくありません", "invalid body"));
  }

  const title = String(payload.title || "").trim();
  const body = String(payload.body || "").trim();
  const audienceType = payload.audience_type ?? "all";
  const audienceSpec = payload.audience_spec ?? {};

  // A dry run answers "who would receive this?" — no campaign row, no LINE call.
  if (payload.dry_run) {
    const audience = await resolveAudience(audienceType, audienceSpec);
    return ok({ dry_run: true, recipients: audience.length });
  }

  if (!title) return fail(tr("タイトルを入力してください", "title is required"));
  if (!body) return fail(tr("メッセージを入力してください", "message body is required"));

  // MVP single-store: resolve the default store.
  const storeId = await resolveStoreForLine(undefined);
  if (!storeId) return fail(tr("店舗が設定されていません", "No store configured"), 500);

  try {
    const summary = await sendCampaignNow({
      storeId,
      title,
      body,
      audienceType,
      audienceSpec,
      createdBy: currentAdmin() ?? "unknown",
    });
    return ok({ ...summary });
  } catch (err) {
    return fail(tr("送信に失敗しました: ", "Send failed: ") + String(err), 500);
  }
}
