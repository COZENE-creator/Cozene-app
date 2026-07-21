import { guardApi, currentAdmin } from "@/lib/auth-server";
import { resolveStoreForLine } from "@/lib/stores";
import { ok, fail, readJsonBody } from "@/lib/http";
import { sendCampaignNow } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  title?: string;
  body?: string;
  audience_type?: "all" | "tag" | "segment";
  audience_spec?: { tag_ids?: string[] };
};

export async function POST(req: Request) {
  const unauth = guardApi();
  if (unauth) return unauth;

  let payload: Body;
  try {
    payload = await readJsonBody<Body>(req);
  } catch {
    return fail("invalid body");
  }

  const title = String(payload.title || "").trim();
  const body = String(payload.body || "").trim();
  const audienceType = payload.audience_type ?? "all";
  if (!title) return fail("title is required");
  if (!body) return fail("message body is required");

  // MVP single-store: resolve the default store.
  const storeId = await resolveStoreForLine(undefined);
  if (!storeId) return fail("No store configured", 500);

  try {
    const summary = await sendCampaignNow({
      storeId,
      title,
      body,
      audienceType,
      audienceSpec: payload.audience_spec ?? {},
      createdBy: currentAdmin() ?? "unknown",
    });
    return ok({ ...summary });
  } catch (err) {
    return fail("Send failed: " + String(err), 500);
  }
}
