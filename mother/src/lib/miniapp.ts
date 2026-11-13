import { query, queryOne } from "./db";

/**
 * Mini App domain logic: public store page + menu, table check-in, the member
 * card, and first-visit benefits. Route handlers stay thin and call these.
 */

/** A re-scan within this window updates the same visit instead of counting a new one. */
const VISIT_DEDUP_HOURS = 3;
/** A first-visit benefit can be shown to staff for this long after that check-in. */
const BENEFIT_WINDOW_HOURS = 6;

// ─── public store page ─────────────────────────────────────────────────────

export type StoreProfile = {
  id: string;
  slug: string;
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

const PROFILE_COLUMNS = `id, slug, name, tagline, concept, hours, address, access, phone,
  map_url, hero_image_url, photos, theme_color`;

export function getStoreProfileBySlug(slug: string): Promise<StoreProfile | null> {
  return queryOne<StoreProfile>(`SELECT ${PROFILE_COLUMNS} FROM stores WHERE slug = $1`, [slug]);
}

export function getStoreProfile(id: string): Promise<StoreProfile | null> {
  return queryOne<StoreProfile>(`SELECT ${PROFILE_COLUMNS} FROM stores WHERE id = $1`, [id]);
}

export type MenuItem = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number | null;
  price_note: string | null;
  image_url: string | null;
  sort_order: number;
  is_available: boolean;
};

export type MenuCategory = {
  id: string;
  key: string;
  label: string;
  sort_order: number;
  items: MenuItem[];
};

/** The store's menu grouped by category. Guests only see available items. */
export async function getMenu(storeId: string, opts: { includeHidden?: boolean } = {}): Promise<MenuCategory[]> {
  const [cats, items] = await Promise.all([
    query<Omit<MenuCategory, "items">>(
      `SELECT id, key, label, sort_order FROM menu_categories
        WHERE store_id = $1 ORDER BY sort_order, label`,
      [storeId]
    ),
    query<MenuItem>(
      `SELECT id, category_id, name, description, price::int AS price, price_note, image_url,
              sort_order, is_available
         FROM menu_items
        WHERE store_id = $1 AND ($2::boolean OR is_available)
        ORDER BY sort_order, name`,
      [storeId, opts.includeHidden === true]
    ),
  ]);
  return cats.map((c) => ({ ...c, items: items.filter((i) => i.category_id === c.id) }));
}

// ─── check-in ──────────────────────────────────────────────────────────────

export type Visit = {
  visit_id: string;
  checked_in_at: string;
  table_no: string | null;
  party_size: number | null;
};

/**
 * Record a table check-in. Re-scanning the QR during the same evening (or
 * reopening the app) updates that visit rather than inflating the visit count.
 */
export async function checkIn(input: {
  storeId: string;
  userId: string;
  lineUserId: string;
  tableNo: string | null;
  partySize: number | null;
  raw: unknown;
}): Promise<{ visit: Visit; isNew: boolean }> {
  const recent = await queryOne<Visit>(
    `UPDATE visits
        SET table_no   = COALESCE($3, table_no),
            party_size = COALESCE($4, party_size)
      WHERE visit_id = (
              SELECT visit_id FROM visits
               WHERE store_id = $1 AND user_id = $2
                 AND checked_in_at > now() - make_interval(hours => $5)
               ORDER BY checked_in_at DESC LIMIT 1)
      RETURNING visit_id, checked_in_at, table_no, party_size`,
    [input.storeId, input.userId, input.tableNo, input.partySize, VISIT_DEDUP_HOURS]
  );
  if (recent) return { visit: recent, isNew: false };

  const visit = await queryOne<Visit>(
    `INSERT INTO visits (store_id, user_ref, id_source, user_id, checked_in_at, table_no, party_size, raw_payload)
       VALUES ($1, $2, 'miniapp', $3, now(), $4, $5, $6)
     RETURNING visit_id, checked_in_at, table_no, party_size`,
    [input.storeId, input.lineUserId, input.userId, input.tableNo, input.partySize, JSON.stringify(input.raw ?? {})]
  );
  return { visit: visit!, isNew: true };
}

// ─── member card ───────────────────────────────────────────────────────────

export type MemberSummary = {
  visit_count: number;
  first_visit_at: string | null;
  last_visit_at: string | null;
  /** The visit in progress (checked in within the dedup window), if any. */
  current_visit: Visit | null;
};

export async function getMemberSummary(storeId: string, userId: string): Promise<MemberSummary> {
  const [agg, current] = await Promise.all([
    queryOne<{ visit_count: number; first_visit_at: string | null; last_visit_at: string | null }>(
      `SELECT count(*)::int AS visit_count, min(checked_in_at) AS first_visit_at,
              max(checked_in_at) AS last_visit_at
         FROM visits WHERE store_id = $1 AND user_id = $2`,
      [storeId, userId]
    ),
    queryOne<Visit>(
      `SELECT visit_id, checked_in_at, table_no, party_size
         FROM visits
        WHERE store_id = $1 AND user_id = $2
          AND checked_in_at > now() - make_interval(hours => $3)
        ORDER BY checked_in_at DESC LIMIT 1`,
      [storeId, userId, VISIT_DEDUP_HOURS]
    ),
  ]);
  return {
    visit_count: agg?.visit_count ?? 0,
    first_visit_at: agg?.first_visit_at ?? null,
    last_visit_at: agg?.last_visit_at ?? null,
    current_visit: current,
  };
}

// ─── benefits ──────────────────────────────────────────────────────────────

/**
 * locked    — never checked in here yet: scan the table QR to unlock
 * available — this is the guest's first visit and it is still in progress
 * redeemed  — already used (once per guest)
 * expired   — first visit has passed without redeeming it
 */
export type BenefitStatus = "locked" | "available" | "redeemed" | "expired";

export type BenefitState = {
  key: string;
  title: string;
  description: string | null;
  status: BenefitStatus;
  redeemed_at: string | null;
  /** The first visit the benefit belongs to (set when available). */
  visit_id: string | null;
};

export async function getBenefits(storeId: string, guestId: string, userId: string): Promise<BenefitState[]> {
  const rows = await query<{
    id: string;
    key: string;
    title: string;
    description: string | null;
    redeemed_at: string | null;
  }>(
    `SELECT b.id, b.key, b.title, b.description, r.redeemed_at
       FROM benefits b
       LEFT JOIN benefit_redemptions r ON r.benefit_id = b.id AND r.guest_id = $2
      WHERE b.store_id = $1 AND b.is_active AND b.rule = 'first_visit'
      ORDER BY b.created_at`,
    [storeId, guestId]
  );
  if (rows.length === 0) return [];

  const first = await queryOne<{ visit_id: string; in_window: boolean }>(
    `SELECT visit_id, checked_in_at > now() - make_interval(hours => $3) AS in_window
       FROM visits WHERE store_id = $1 AND user_id = $2
      ORDER BY checked_in_at ASC LIMIT 1`,
    [storeId, userId, BENEFIT_WINDOW_HOURS]
  );

  return rows.map((b) => {
    let status: BenefitStatus;
    if (b.redeemed_at) status = "redeemed";
    else if (!first) status = "locked";
    else if (first.in_window) status = "available";
    else status = "expired";
    return {
      key: b.key,
      title: b.title,
      description: b.description,
      status,
      redeemed_at: b.redeemed_at,
      visit_id: status === "available" ? first!.visit_id : null,
    };
  });
}

/**
 * Mark a benefit used. The unique (benefit_id, guest_id) key makes this
 * at-most-once even if two phones submit at the same moment.
 */
export async function redeemBenefit(input: {
  storeId: string;
  guestId: string;
  userId: string;
  benefitKey: string;
}): Promise<{ ok: true; redeemed_at: string } | { ok: false; error: string }> {
  const states = await getBenefits(input.storeId, input.guestId, input.userId);
  const state = states.find((b) => b.key === input.benefitKey);
  if (!state) return { ok: false, error: "Unknown benefit" };
  if (state.status === "redeemed") return { ok: false, error: "Already used" };
  if (state.status !== "available") return { ok: false, error: "Not available for this visit" };

  const row = await queryOne<{ redeemed_at: string }>(
    `INSERT INTO benefit_redemptions (benefit_id, store_id, guest_id, user_id, visit_id)
       SELECT b.id, b.store_id, $3, $4, $5 FROM benefits b WHERE b.store_id = $1 AND b.key = $2
     ON CONFLICT (benefit_id, guest_id) DO NOTHING
     RETURNING redeemed_at`,
    [input.storeId, input.benefitKey, input.guestId, input.userId, state.visit_id]
  );
  if (!row) return { ok: false, error: "Already used" };
  return { ok: true, redeemed_at: row.redeemed_at };
}

export function getStaffPinHash(storeId: string): Promise<{ staff_pin_hash: string | null } | null> {
  return queryOne(`SELECT staff_pin_hash FROM stores WHERE id = $1`, [storeId]);
}
