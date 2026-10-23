import { query, queryOne } from "./db";
import { upsertIdentity } from "./identity";

/**
 * Guests — one person across every Cozene store.
 *
 * All stores share one Mini App under one LINE provider, so the LINE userId is
 * the same at each store. `guests` holds that person; each store still has its
 * own `users` row (push target, tags, per-store history) pointing at the guest.
 */

/** Bump when the consent wording changes; guests are asked again. */
export const POLICY_VERSION = process.env.CONSENT_POLICY_VERSION || "2026-10";

export type ConsentScope = "store_use" | "partner_sharing";

export type ConsentState = {
  store_use: boolean;
  partner_sharing: boolean;
  /** True when the guest must (re)answer: never asked, or asked under an older wording. */
  needs_consent: boolean;
};

export async function upsertGuest(
  lineUserId: string,
  profile: { name?: string | null; picture?: string | null } = {}
): Promise<string> {
  const row = await queryOne<{ id: string }>(
    `INSERT INTO guests (line_user_id, display_name, picture_url)
       VALUES ($1, $2, $3)
     ON CONFLICT (line_user_id) DO UPDATE
       SET display_name = COALESCE(EXCLUDED.display_name, guests.display_name),
           picture_url  = COALESCE(EXCLUDED.picture_url, guests.picture_url),
           updated_at   = now()
     RETURNING id`,
    [lineUserId, profile.name ?? null, profile.picture ?? null]
  );
  return row!.id;
}

/**
 * Ensure the guest has a `users` row at this store and that it points at them.
 * Returns the per-store user id (what visits / orders / pushes key on).
 */
export async function ensureStoreMember(
  storeId: string,
  guestId: string,
  lineUserId: string,
  displayName: string | null
): Promise<string> {
  const row = await queryOne<{ id: string }>(
    `INSERT INTO users (store_id, line_user_id, display_name, guest_id)
       VALUES ($1, $2, $3, $4)
     ON CONFLICT (store_id, line_user_id) DO UPDATE
       SET display_name = COALESCE(EXCLUDED.display_name, users.display_name),
           guest_id     = EXCLUDED.guest_id,
           updated_at   = now()
     RETURNING id`,
    [storeId, lineUserId, displayName, guestId]
  );
  await upsertIdentity(storeId, "miniapp", lineUserId, row!.id);
  return row!.id;
}

/** Latest decision per scope for this guest at this store. */
export async function getConsentState(guestId: string, storeId: string): Promise<ConsentState> {
  const rows = await query<{ scope: ConsentScope; granted: boolean; policy_version: string }>(
    `SELECT DISTINCT ON (scope) scope, granted, policy_version
       FROM consents
      WHERE guest_id = $1 AND store_id = $2
      ORDER BY scope, decided_at DESC`,
    [guestId, storeId]
  );
  const by = Object.fromEntries(rows.map((r) => [r.scope, r]));
  const storeUse = by.store_use;
  return {
    store_use: storeUse?.granted === true,
    partner_sharing: by.partner_sharing?.granted === true,
    needs_consent: !storeUse || !storeUse.granted || storeUse.policy_version !== POLICY_VERSION,
  };
}

/** Append the guest's answers (history is kept; the latest row wins). */
export async function recordConsent(
  guestId: string,
  storeId: string,
  answers: Partial<Record<ConsentScope, boolean>>
): Promise<void> {
  for (const scope of ["store_use", "partner_sharing"] as const) {
    const granted = answers[scope];
    if (typeof granted !== "boolean") continue;
    await query(
      `INSERT INTO consents (guest_id, store_id, scope, granted, policy_version)
         VALUES ($1, $2, $3, $4, $5)`,
      [guestId, storeId, scope, granted, POLICY_VERSION]
    );
  }
}
