import { queryOne } from "@/lib/db";
import { guardApi } from "@/lib/auth-server";
import { resolveStoreForLine } from "@/lib/stores";
import { ok, fail, readJsonBody } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { key?: string; label?: string; description?: string };

/** Create a tag definition. */
export async function POST(req: Request) {
  const unauth = guardApi();
  if (unauth) return unauth;

  let body: Body;
  try {
    body = await readJsonBody<Body>(req);
  } catch {
    return fail("invalid body");
  }
  const key = String(body.key || "").trim();
  const label = String(body.label || "").trim();
  if (!key || !label) return fail("key and label are required");

  const storeId = await resolveStoreForLine(undefined);
  if (!storeId) return fail("No store configured", 500);

  const row = await queryOne<{ id: string }>(
    `INSERT INTO tags (store_id, key, label, description)
       VALUES ($1, $2, $3, $4)
     ON CONFLICT (store_id, key) DO UPDATE SET label = EXCLUDED.label, description = EXCLUDED.description
     RETURNING id`,
    [storeId, key, label, body.description ?? null]
  );
  return ok({ id: row!.id });
}
