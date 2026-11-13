import { query, queryOne } from "./db";

export type CustomerRow = {
  id: string;
  store_id: string;
  line_user_id: string | null;
  display_name: string | null;
  is_friend: boolean;
  visit_count: number;
  order_count: number;
  total_spend: number;
  currency: string | null;
  last_seen: string | null;
  tags: string[];
};

/** Customer list with behavior aggregates (visits, orders, spend, tags). */
export function listCustomers(): Promise<CustomerRow[]> {
  return query<CustomerRow>(
    `SELECT u.id, u.store_id, u.line_user_id, u.display_name, u.is_friend,
            COALESCE(v.visit_count, 0)   AS visit_count,
            COALESCE(o.order_count, 0)   AS order_count,
            COALESCE(o.total_spend, 0)   AS total_spend,
            o.currency,
            GREATEST(v.last_visit, o.last_order) AS last_seen,
            COALESCE(t.tags, '{}')       AS tags
       FROM users u
       LEFT JOIN (
         SELECT user_id, count(*)::int AS visit_count, max(checked_in_at) AS last_visit
           FROM visits WHERE user_id IS NOT NULL GROUP BY user_id
       ) v ON v.user_id = u.id
       LEFT JOIN (
         SELECT user_id, count(*)::int AS order_count,
                COALESCE(sum(total_amount), 0)::bigint AS total_spend,
                max(currency) AS currency, max(ordered_at) AS last_order
           FROM orders WHERE user_id IS NOT NULL GROUP BY user_id
       ) o ON o.user_id = u.id
       LEFT JOIN (
         SELECT ut.user_id, array_agg(tg.label ORDER BY tg.label) AS tags
           FROM user_tags ut JOIN tags tg ON tg.id = ut.tag_id
          GROUP BY ut.user_id
       ) t ON t.user_id = u.id
      ORDER BY last_seen DESC NULLS LAST, u.created_at DESC`
  );
}

export type CustomerDetail = CustomerRow & { followed_at: string | null };

export function getCustomer(id: string): Promise<CustomerDetail | null> {
  return queryOne<CustomerDetail>(
    `SELECT u.id, u.store_id, u.line_user_id, u.display_name, u.is_friend, u.followed_at,
            0 AS visit_count, 0 AS order_count, 0 AS total_spend, NULL AS currency,
            NULL AS last_seen, '{}'::text[] AS tags
       FROM users u WHERE u.id = $1`,
    [id]
  );
}

export type TimelineEvent = {
  kind: "visit" | "order" | "payment";
  at: string;
  detail: string;
  amount: number | null;
};

/** Unified visit/order/payment timeline for one customer. */
export function getCustomerTimeline(id: string): Promise<TimelineEvent[]> {
  return query<TimelineEvent>(
    `SELECT 'visit'::text AS kind, checked_in_at AS at,
            concat_ws(' · ', id_source, 'Table ' || table_no, party_size || ' guests') AS detail,
            NULL::bigint AS amount
       FROM visits WHERE user_id = $1
     UNION ALL
     SELECT 'order', COALESCE(ordered_at, created_at), COALESCE(state, source), total_amount
       FROM orders WHERE user_id = $1
     UNION ALL
     SELECT 'payment', COALESCE(paid_at, created_at), COALESCE(status, ''), amount
       FROM payments WHERE user_id = $1
     ORDER BY at DESC
     LIMIT 200`,
    [id]
  );
}

/** Tag ids currently assigned to a user. */
export async function getUserTagIds(userId: string): Promise<string[]> {
  const rows = await query<{ tag_id: string }>(
    `SELECT tag_id FROM user_tags WHERE user_id = $1`,
    [userId]
  );
  return rows.map((r) => r.tag_id);
}

export type TagRow = { id: string; key: string; label: string; description: string | null; usage: number };

export function listTags(): Promise<TagRow[]> {
  return query<TagRow>(
    `SELECT t.id, t.key, t.label, t.description,
            COALESCE(c.usage, 0)::int AS usage
       FROM tags t
       LEFT JOIN (SELECT tag_id, count(*) AS usage FROM user_tags GROUP BY tag_id) c
         ON c.tag_id = t.id
      ORDER BY t.label`
  );
}

export type AudienceType = "all" | "tag" | "segment" | "rating";
export type AudienceSpec = { tag_ids?: string[]; special_id?: string; ratings?: string[] };

/**
 * Guests who said no to (or withdrew) store data use in the Mini App are never
 * messaged. Users with no consent record (pre-Mini App LIFF check-ins, OA
 * friends who never opened the app) are unaffected.
 */
const NOT_DECLINED = `COALESCE((
    SELECT c.granted FROM consents c
     WHERE c.guest_id = u.guest_id AND c.store_id = u.store_id AND c.scope = 'store_use'
     ORDER BY c.decided_at DESC LIMIT 1), true)`;

/** Resolve the audience (friend users) for a campaign spec. Returns pushable users. */
export function resolveAudience(
  audienceType: AudienceType,
  spec: AudienceSpec
): Promise<{ id: string; line_user_id: string; store_id: string }[]> {
  // Guests who rated a given weekly special a given way — the feedback loop
  // that turns the post-payment screen into targeted follow-up.
  if (audienceType === "rating" && spec.special_id && spec.ratings?.length) {
    return query(
      `SELECT DISTINCT u.id, u.line_user_id, u.store_id
         FROM users u
         JOIN special_ratings sr ON sr.user_id = u.id
        WHERE u.is_friend = true AND u.line_user_id IS NOT NULL
          AND sr.special_id = $1::uuid
          AND sr.rating = ANY($2::text[])
          AND ${NOT_DECLINED}`,
      [spec.special_id, spec.ratings]
    );
  }

  if (audienceType === "tag" && spec.tag_ids?.length) {
    return query(
      `SELECT DISTINCT u.id, u.line_user_id, u.store_id
         FROM users u
         JOIN user_tags ut ON ut.user_id = u.id
        WHERE u.is_friend = true AND u.line_user_id IS NOT NULL
          AND ut.tag_id = ANY($1::uuid[])
          AND ${NOT_DECLINED}`,
      [spec.tag_ids]
    );
  }
  // 'all' (and 'segment' until a rule builder exists) → all pushable friends.
  return query(
    `SELECT u.id, u.line_user_id, u.store_id
       FROM users u
      WHERE u.is_friend = true AND u.line_user_id IS NOT NULL
        AND ${NOT_DECLINED}`
  );
}

export type CustomerMiniApp = {
  store_use: boolean | null;
  partner_sharing: boolean | null;
  consent_at: string | null;
  policy_version: string | null;
  benefits: { title: string; redeemed_at: string }[];
};

/** Mini App status for a customer: latest consent answers and redeemed benefits. */
export async function getCustomerMiniApp(userId: string): Promise<CustomerMiniApp> {
  const [consent, benefits] = await Promise.all([
    queryOne<Omit<CustomerMiniApp, "benefits">>(
      `SELECT
         (SELECT granted FROM consents c WHERE c.guest_id = u.guest_id AND c.store_id = u.store_id
             AND c.scope = 'store_use' ORDER BY decided_at DESC LIMIT 1) AS store_use,
         (SELECT granted FROM consents c WHERE c.guest_id = u.guest_id AND c.store_id = u.store_id
             AND c.scope = 'partner_sharing' ORDER BY decided_at DESC LIMIT 1) AS partner_sharing,
         (SELECT max(decided_at) FROM consents c WHERE c.guest_id = u.guest_id AND c.store_id = u.store_id) AS consent_at,
         (SELECT policy_version FROM consents c WHERE c.guest_id = u.guest_id AND c.store_id = u.store_id
             ORDER BY decided_at DESC LIMIT 1) AS policy_version
         FROM users u WHERE u.id = $1`,
      [userId]
    ),
    query<{ title: string; redeemed_at: string }>(
      `SELECT b.title, r.redeemed_at
         FROM benefit_redemptions r JOIN benefits b ON b.id = r.benefit_id
        WHERE r.user_id = $1 ORDER BY r.redeemed_at DESC`,
      [userId]
    ),
  ]);
  return {
    store_use: consent?.store_use ?? null,
    partner_sharing: consent?.partner_sharing ?? null,
    consent_at: consent?.consent_at ?? null,
    policy_version: consent?.policy_version ?? null,
    benefits,
  };
}
