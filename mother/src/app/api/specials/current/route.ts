import { resolveStoreId } from "@/lib/db";
import { getCurrentSpecial, getUserRating } from "@/lib/specials";
import { findUserByLineId } from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Same CORS posture as /api/checkin: the LIFF client is served from another origin.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

/**
 * The special to show on the post-payment rating screen, plus this guest's
 * existing answer (so a re-open shows what they already chose).
 *
 * GET /api/specials/current?store_id=store_001&user_ref=U123
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const storeSlug = (url.searchParams.get("store_id") || "").trim();
  const userRef = (url.searchParams.get("user_ref") || "").trim();
  if (!storeSlug) return json(400, { ok: false, error: "store_id is required" });

  const storeId = await resolveStoreId(storeSlug);
  if (!storeId) return json(404, { ok: false, error: `Unknown store_id: ${storeSlug}` });

  const special = await getCurrentSpecial(storeId);
  if (!special) return json(200, { ok: true, special: null });

  // Read-only: don't create a user row just because a screen was opened.
  let myRating: string | null = null;
  if (userRef) {
    const user = await findUserByLineId(storeId, userRef);
    if (user) myRating = await getUserRating(special.id, user.id);
  }

  return json(200, {
    ok: true,
    special: {
      id: special.id,
      title: special.title,
      description: special.description,
      image_url: special.image_url,
      week_start: special.week_start,
    },
    my_rating: myRating,
  });
}
