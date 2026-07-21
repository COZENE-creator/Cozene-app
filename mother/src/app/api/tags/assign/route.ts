import { query, queryOne } from "@/lib/db";
import { guardApi } from "@/lib/auth-server";
import { ok, fail, readJsonBody } from "@/lib/http";

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
  const userId = String(body.user_id || "");
  const tagId = String(body.tag_id || "");
  if (!userId || !tagId) return fail("user_id and tag_id are required");

  if (body.action === "unassign") {
    await query(`DELETE FROM user_tags WHERE user_id = $1 AND tag_id = $2`, [userId, tagId]);
    return ok({ assigned: false });
  }

  // Derive store_id from the tag to keep the row consistent.
  const tag = await queryOne<{ store_id: string }>(`SELECT store_id FROM tags WHERE id = $1`, [tagId]);
  if (!tag) return fail("unknown tag", 404);

  await query(
    `INSERT INTO user_tags (store_id, user_id, tag_id, source)
       VALUES ($1, $2, $3, 'manual')
     ON CONFLICT (user_id, tag_id) DO NOTHING`,
    [tag.store_id, userId, tagId]
  );
  return ok({ assigned: true });
}
