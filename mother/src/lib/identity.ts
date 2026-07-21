import { query, queryOne } from "./db";

/**
 * Identity resolution — the crux of the data model.
 *
 * `users` is keyed on the push-capable LINE userId. Because the LIFF login
 * channel and the Messaging API channel share a provider (linked), the LIFF
 * `userId` IS the push userId, so a check-in can create/point at a users row
 * directly. `user_identities` additionally records every source ref (liff,
 * square, ...) so refs that lack a LINE id (e.g. a Square customer) can be
 * linked later without losing data.
 */

export type IdSource = "liff" | "miniapp" | "messaging" | "square";

/**
 * Ensure a `users` row exists for a push-capable LINE userId within a store.
 * Returns the user's uuid. Idempotent on (store_id, line_user_id).
 */
export async function upsertUserByLineId(
  storeId: string,
  lineUserId: string,
  fields: { displayName?: string | null } = {}
): Promise<string> {
  const row = await queryOne<{ id: string }>(
    `INSERT INTO users (store_id, line_user_id, display_name)
       VALUES ($1, $2, $3)
     ON CONFLICT (store_id, line_user_id) DO UPDATE
       SET display_name = COALESCE(EXCLUDED.display_name, users.display_name),
           updated_at   = now()
     RETURNING id`,
    [storeId, lineUserId, fields.displayName ?? null]
  );
  return row!.id;
}

/**
 * Record a source identity and link it to a user (if known). Idempotent on
 * (store_id, id_source, external_ref).
 */
export async function upsertIdentity(
  storeId: string,
  idSource: IdSource,
  externalRef: string,
  userId: string | null
): Promise<void> {
  await query(
    `INSERT INTO user_identities (store_id, id_source, external_ref, user_id, linked_at)
       VALUES ($1, $2, $3, $4::uuid, CASE WHEN $4::uuid IS NULL THEN NULL ELSE now() END)
     ON CONFLICT (store_id, id_source, external_ref) DO UPDATE
       SET user_id   = COALESCE(EXCLUDED.user_id, user_identities.user_id),
           linked_at = COALESCE(user_identities.linked_at, EXCLUDED.linked_at)`,
    [storeId, idSource, externalRef, userId]
  );
}

/** Look up the user a given source ref resolves to, or null if unlinked. */
export async function resolveUserId(
  storeId: string,
  idSource: IdSource,
  externalRef: string
): Promise<string | null> {
  const row = await queryOne<{ user_id: string | null }>(
    `SELECT user_id FROM user_identities
      WHERE store_id = $1 AND id_source = $2 AND external_ref = $3`,
    [storeId, idSource, externalRef]
  );
  return row?.user_id ?? null;
}
