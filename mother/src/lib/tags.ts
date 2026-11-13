import { query, queryOne } from "./db";

export type TagToggleResult = { ok: true; assigned: boolean } | { ok: false; error: string };

/**
 * Assign or remove a tag for one customer (source='manual').
 * Shared by the API route (/api/tags/assign) and the admin server action so
 * both write identical rows — the Phase-3 Claude tagger writes here too, with
 * source='claude' and a confidence.
 */
export async function setUserTag(
  userId: string,
  tagId: string,
  action: "assign" | "unassign"
): Promise<TagToggleResult> {
  if (!userId || !tagId) return { ok: false, error: "user_id and tag_id are required" };

  if (action === "unassign") {
    await query(`DELETE FROM user_tags WHERE user_id = $1 AND tag_id = $2`, [userId, tagId]);
    return { ok: true, assigned: false };
  }

  // Derive store_id from the tag to keep the row consistent.
  const tag = await queryOne<{ store_id: string }>(`SELECT store_id FROM tags WHERE id = $1`, [tagId]);
  if (!tag) return { ok: false, error: "unknown tag" };

  await query(
    `INSERT INTO user_tags (store_id, user_id, tag_id, source)
       VALUES ($1, $2, $3, 'manual')
     ON CONFLICT (user_id, tag_id) DO NOTHING`,
    [tag.store_id, userId, tagId]
  );
  return { ok: true, assigned: true };
}
