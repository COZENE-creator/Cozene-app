import { queryOne } from "./db";

/**
 * Resolve which store a webhook belongs to.
 *
 * Precedence:
 *   1. Explicit match on the given column (LINE `destination` / Square location_id).
 *   2. LINE_DEFAULT_STORE_SLUG / the single configured store, so a single-store
 *      MVP works without wiring channel refs first.
 */
async function defaultStoreId(): Promise<string | null> {
  const slug = process.env.DEFAULT_STORE_SLUG;
  if (slug) {
    const row = await queryOne<{ id: string }>("SELECT id FROM stores WHERE slug = $1", [slug]);
    if (row) return row.id;
  }
  // Fall back to the sole store if exactly one exists.
  const only = await queryOne<{ id: string; n: number }>(
    "SELECT id, (SELECT count(*)::int FROM stores) AS n FROM stores LIMIT 1"
  );
  return only && only.n === 1 ? only.id : null;
}

/** Store for an inbound LINE webhook, keyed on `destination` (the bot userId). */
export async function resolveStoreForLine(destination: string | undefined): Promise<string | null> {
  if (destination) {
    const row = await queryOne<{ id: string }>(
      "SELECT id FROM stores WHERE line_channel_ref = $1",
      [destination]
    );
    if (row) return row.id;
  }
  return defaultStoreId();
}

/** Store for an inbound Square webhook, keyed on the Square location id. */
export async function resolveStoreForSquare(locationId: string | undefined): Promise<string | null> {
  if (locationId) {
    const row = await queryOne<{ id: string }>(
      "SELECT id FROM stores WHERE square_location_id = $1",
      [locationId]
    );
    if (row) return row.id;
  }
  return defaultStoreId();
}
