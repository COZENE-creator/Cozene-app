import { guardApi, currentAdmin } from "@/lib/auth-server";
import { resolveStoreForLine } from "@/lib/stores";
import { ok, fail, readJsonBody } from "@/lib/http";
import { sendCampaignNow } from "@/lib/push";
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

  let payload: Body;
  try {
    payload = await readJsonBody<Body>(req);
  } catch {
    return fail("invalid body");
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
      audienceSpec,
      createdBy: currentAdmin() ?? "unknown",
    });
    return ok({ ...summary });
  } catch (err) {
    return fail("Send failed: " + String(err), 500);
  }
}
