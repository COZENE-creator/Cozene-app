import { guardApi } from "@/lib/auth-server";
import { ok, fail, readJsonBody } from "@/lib/http";
import { setUserTag } from "@/lib/tags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { user_id?: string; tag_id?: string; action?: "assign" | "unassign" };

/** Manually assign or remove a tag for a customer (source='manual'). */
export async function POST(req: Request) {
  const unauth = guardApi();
  if (unauth) return unauth;

  let body: Body;
  try {
    body = await readJsonBody<Body>(req);
  } catch {
    return fail("invalid body");
  }

  const result = await setUserTag(
    String(body.user_id || ""),
    String(body.tag_id || ""),
    body.action === "unassign" ? "unassign" : "assign"
  );
  if (!result.ok) return fail(result.error, result.error === "unknown tag" ? 404 : 400);
  return ok({ assigned: result.assigned });
}
