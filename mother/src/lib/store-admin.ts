import { query, queryOne } from "./db";
import { resolveStoreForLine } from "./stores";
import { hashPin } from "./pin";

/**
 * Admin-side editing of what the Mini App shows: store profile, staff PIN,
 * menu, and the benefit redemption log.
 */

/** The store the admin console edits (DEFAULT_STORE_SLUG, or the only store). */
export function adminStoreId(): Promise<string | null> {
  return resolveStoreForLine(undefined);
}

export type StoreProfileInput = {
  name: string;
  tagline: string | null;
  concept: string | null;
  hours: string | null;
  address: string | null;
  access: string | null;
  phone: string | null;
  map_url: string | null;
  hero_image_url: string | null;
  photos: string[];
  theme_color: string | null;
};

export async function updateStoreProfile(storeId: string, p: StoreProfileInput): Promise<void> {
  await query(
    `UPDATE stores
        SET name = $2, tagline = $3, concept = $4, hours = $5, address = $6, access = $7,
            phone = $8, map_url = $9, hero_image_url = $10, photos = $11::jsonb, theme_color = $12,
            updated_at = now()
      WHERE id = $1`,
    [storeId, p.name, p.tagline, p.concept, p.hours, p.address, p.access, p.phone,
     p.map_url, p.hero_image_url, JSON.stringify(p.photos), p.theme_color]
  );
}

export async function setStaffPin(storeId: string, pin: string): Promise<void> {
  await query(`UPDATE stores SET staff_pin_hash = $2, updated_at = now() WHERE id = $1`, [storeId, hashPin(pin)]);
}

export async function hasStaffPin(storeId: string): Promise<boolean> {
  const row = await queryOne<{ set: boolean }>(
    `SELECT staff_pin_hash IS NOT NULL AS set FROM stores WHERE id = $1`,
    [storeId]
  );
  return row?.set === true;
}

// ─── menu ──────────────────────────────────────────────────────────────────

export async function upsertCategory(
  storeId: string,
  c: { id?: string; key: string; label: string; sort_order: number }
): Promise<void> {
  if (c.id) {
    await query(
      `UPDATE menu_categories SET label = $3, sort_order = $4 WHERE id = $1 AND store_id = $2`,
      [c.id, storeId, c.label, c.sort_order]
    );
    return;
  }
  await query(
    `INSERT INTO menu_categories (store_id, key, label, sort_order) VALUES ($1, $2, $3, $4)
     ON CONFLICT (store_id, key) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order`,
    [storeId, c.key, c.label, c.sort_order]
  );
}

export async function deleteCategory(storeId: string, id: string): Promise<void> {
  await query(`DELETE FROM menu_categories WHERE id = $1 AND store_id = $2`, [id, storeId]);
}

export type MenuItemInput = {
  id?: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number | null;
  price_note: string | null;
  image_url: string | null;
  sort_order: number;
  is_available: boolean;
};

export async function upsertMenuItem(storeId: string, i: MenuItemInput): Promise<void> {
  // The category must belong to the same store (no cross-store writes).
  const cat = await queryOne(`SELECT 1 FROM menu_categories WHERE id = $1 AND store_id = $2`, [i.category_id, storeId]);
  if (!cat) throw new Error("Unknown category");

  const params = [storeId, i.category_id, i.name, i.description, i.price, i.price_note,
                  i.image_url, i.sort_order, i.is_available];
  if (i.id) {
    await query(
      `UPDATE menu_items
          SET category_id = $2, name = $3, description = $4, price = $5, price_note = $6,
              image_url = $7, sort_order = $8, is_available = $9, updated_at = now()
        WHERE id = $10 AND store_id = $1`,
      [...params, i.id]
    );
  } else {
    await query(
      `INSERT INTO menu_items (store_id, category_id, name, description, price, price_note,
                               image_url, sort_order, is_available)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      params
    );
  }
}

export async function deleteMenuItem(storeId: string, id: string): Promise<void> {
  await query(`DELETE FROM menu_items WHERE id = $1 AND store_id = $2`, [id, storeId]);
}

// ─── redemptions ───────────────────────────────────────────────────────────

export type RedemptionRow = {
  id: string;
  redeemed_at: string;
  benefit_title: string;
  user_id: string | null;
  display_name: string | null;
  table_no: string | null;
  party_size: number | null;
};

export function listRedemptions(storeId: string, limit = 50): Promise<RedemptionRow[]> {
  return query<RedemptionRow>(
    `SELECT r.id, r.redeemed_at, b.title AS benefit_title, r.user_id,
            COALESCE(u.display_name, g.display_name) AS display_name,
            v.table_no, v.party_size
       FROM benefit_redemptions r
       JOIN benefits b ON b.id = r.benefit_id
       JOIN guests g ON g.id = r.guest_id
       LEFT JOIN users u ON u.id = r.user_id
       LEFT JOIN visits v ON v.visit_id = r.visit_id
      WHERE r.store_id = $1
      ORDER BY r.redeemed_at DESC
      LIMIT $2`,
    [storeId, limit]
  );
}
