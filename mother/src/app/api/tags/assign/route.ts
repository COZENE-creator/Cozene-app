import { guardApi } from "@/lib/auth-server";
import { ok, fail, readJsonBody } from "@/lib/http";
import { setUserTag } from "@/lib/tags";
import { getTr } from "@/lib/lang-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { user_id?: string; tag_id?: string; action?: "assign" | "unassign" };

/** Manually assign or remove a tag for a customer (source='manual'). */
export async function POST(req: Request) {
  const unauth = guardApi();
  if (unauth) return unauth;
  const tr = getTr();

  let body: Body;
  try {
    body = await readJsonBody<Body>(req);
  } catch {
    return fail(tr("リクエストの形式が正しくありません", "invalid body"));
  }

  const result = await setUserTag(
    String(body.user_id || ""),
    String(body.tag_id || ""),
    body.action === "unassign" ? "unassign" : "assign"
  );
  if (!result.ok) {
    const unknown = result.error === "unknown tag";
    const msg = unknown
      ? tr("タグが見つかりません", "unknown tag")
      : result.error === "user_id and tag_id are required"
        ? tr("user_id と tag_id は必須です", result.error)
        : result.error;
    return fail(msg, unknown ? 404 : 400);
  }
  return ok({ assigned: result.assigned });
}
