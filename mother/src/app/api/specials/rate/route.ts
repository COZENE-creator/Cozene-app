import { resolveStoreId } from "@/lib/db";
import { readJsonBody } from "@/lib/http";
import { upsertUserByLineId, upsertIdentity } from "@/lib/identity";
import { getSpecial, getCurrentSpecial, isRating, rateSpecial } from "@/lib/specials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

function json(status: number, obj: unknown) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

type Body = {
  store_id?: string;
  user_ref?: string;
  special_id?: string;
  rating?: string;
  comment?: string;
  id_source?: string;
};

/**
 * Record a guest's rating of the weekly special (the post-payment screen).
 *
 * Re-rating overwrites: the screen lets a guest change their answer, and the
 * unique (special_id, user_id) upsert keeps exactly one row per guest.
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = await readJsonBody<Body>(req);
  } catch (err) {
    return json(400, { ok: false, error: "Invalid request body: " + String(err) });
  }

  const storeSlug = String(body.store_id || "").trim();
  const userRef = String(body.user_ref || "").trim();
  const rating = String(body.rating || "").trim();
  if (!storeSlug) return json(400, { ok: false, error: "store_id is required" });
  if (!userRef) return json(400, { ok: false, error: "user_ref is required" });
  if (!isRating(rating)) return json(400, { ok: false, error: "rating must be good, ok or bad" });

  const storeId = await resolveStoreId(storeSlug);
  if (!storeId) return json(404, { ok: false, error: `Unknown store_id: ${storeSlug}` });

  // Trust the server's idea of the current special when the client doesn't name
  // one, so a stale open tab can't attach a rating to the wrong week.
  const special = body.special_id ? await getSpecial(body.special_id) : await getCurrentSpecial(storeId);
  if (!special) return json(404, { ok: false, error: "No special is running" });
  if (special.store_id !== storeId) return json(400, { ok: false, error: "special does not belong to this store" });

  const idSource = body.id_source === "miniapp" ? "miniapp" : "liff";
  const userId = await upsertUserByLineId(storeId, userRef);
  await upsertIdentity(storeId, idSource, userRef, userId);

  await rateSpecial({
    storeId,
    specialId: special.id,
    userId,
    userRef,
    rating,
    comment: body.comment ?? null,
    source: idSource,
  });

  return json(200, { ok: true, special_id: special.id, rating });
}
