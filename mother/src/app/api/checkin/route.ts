import { queryOne, resolveStoreId } from "@/lib/db";
import { ok, fail, readJsonBody } from "@/lib/http";
import { upsertUserByLineId, upsertIdentity } from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// CORS: the LIFF client is served from a different origin (GitHub Pages).
// text/plain is a "simple" request so no preflight is triggered, but we still
// echo permissive CORS headers for safety across hosting setups.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

type CheckinBody = {
  store_id?: string;
  user_ref?: string;
  id_source?: string;
  checked_in_at?: string;
  raw_payload?: unknown;
};

/**
 * Drop-in replacement for the Phase-1 Apps Script doPost.
 * One check-in -> one `visits` row. Mirrors the old contract exactly:
 * server-assigned visit_id, defaulted timestamp, {ok, visit_id, checked_in_at}.
 */
export async function POST(req: Request) {
  let body: CheckinBody;
  try {
    body = await readJsonBody<CheckinBody>(req);
  } catch (err) {
    return withCors(fail("Invalid request body: " + String(err)));
  }

  const storeSlug = String(body.store_id || "").trim();
  const userRef = String(body.user_ref || "").trim();
  if (!storeSlug) return withCors(fail("store_id is required"));
  if (!userRef) return withCors(fail("user_ref is required"));

  const storeId = await resolveStoreId(storeSlug);
  if (!storeId) return withCors(fail(`Unknown store_id: ${storeSlug}`, 404));

  const idSource = body.id_source === "miniapp" ? "miniapp" : "liff";
  const checkedInAt = body.checked_in_at || new Date().toISOString();
  const rawPayload = body.raw_payload ?? {};

  // Linked channels: the LIFF userId is push-capable, so make/point at a users row.
  const userId = await upsertUserByLineId(storeId, userRef);
  await upsertIdentity(storeId, idSource, userRef, userId);

  const row = await queryOne<{ visit_id: string; checked_in_at: string }>(
    `INSERT INTO visits (store_id, user_ref, id_source, user_id, checked_in_at, raw_payload)
       VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING visit_id, to_char(checked_in_at, 'YYYY-MM-DD"T"HH24:MI:SS.MSOF') AS checked_in_at`,
    [storeId, userRef, idSource, userId, checkedInAt, JSON.stringify(rawPayload)]
  );

  return withCors(ok({ visit_id: row!.visit_id, checked_in_at: row!.checked_in_at }));
}

function withCors(res: Response): Response {
  for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
  return res;
}
