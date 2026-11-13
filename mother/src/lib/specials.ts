import { query, queryOne } from "./db";
import { weekStart, type Rating } from "./special-copy";

// Pure helpers live in ./special-copy so client components can import them too.
export {
  RATINGS,
  RATING_LABEL,
  isRating,
  weekStart,
  buildMessage,
  type Rating,
  type ResultSummary,
} from "./special-copy";

export type Special = {
  id: string;
  store_id: string;
  week_start: string;
  title: string;
  description: string | null;
  image_url: string | null;
  status: string;
};

export type SpecialWithResults = Special & {
  good: number;
  ok: number;
  bad: number;
  responses: number;
  /** Share of responses that were "Good", 0–100. Null when nobody has rated. */
  score: number | null;
};

/**
 * The special a guest should be asked about: this week's if one is set,
 * otherwise the most recent active one (a guest paying Monday morning before
 * the owner has posted the new week should still see last week's dish).
 */
export function getCurrentSpecial(storeId: string, today = new Date()): Promise<Special | null> {
  return queryOne<Special>(
    `SELECT id, store_id, week_start::text, title, description, image_url, status
       FROM specials
      WHERE store_id = $1 AND status = 'active' AND week_start <= $2::date
      ORDER BY week_start DESC
      LIMIT 1`,
    [storeId, weekStart(today)]
  );
}

export function getSpecial(id: string): Promise<Special | null> {
  return queryOne<Special>(
    `SELECT id, store_id, week_start::text, title, description, image_url, status
       FROM specials WHERE id = $1`,
    [id]
  );
}

/** A guest's existing rating for a special, so the screen can show their answer. */
export async function getUserRating(specialId: string, userId: string): Promise<Rating | null> {
  const row = await queryOne<{ rating: Rating }>(
    `SELECT rating FROM special_ratings WHERE special_id = $1 AND user_id = $2`,
    [specialId, userId]
  );
  return row?.rating ?? null;
}

/** Upsert a guest's rating — re-rating overwrites rather than duplicating. */
export async function rateSpecial(input: {
  storeId: string;
  specialId: string;
  userId: string;
  userRef: string;
  rating: Rating;
  comment?: string | null;
  source?: string;
}): Promise<void> {
  await query(
    `INSERT INTO special_ratings (store_id, special_id, user_id, user_ref, rating, comment, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (special_id, user_id) DO UPDATE
       SET rating = EXCLUDED.rating,
           comment = COALESCE(EXCLUDED.comment, special_ratings.comment),
           rated_at = now()`,
    [
      input.storeId,
      input.specialId,
      input.userId,
      input.userRef,
      input.rating,
      input.comment ?? null,
      input.source ?? "liff",
    ]
  );
}

const RESULT_SELECT = `
  SELECT s.id, s.store_id, s.week_start::text, s.title, s.description, s.image_url, s.status,
         COALESCE(r.good, 0)::int      AS good,
         COALESCE(r.ok, 0)::int        AS ok,
         COALESCE(r.bad, 0)::int       AS bad,
         COALESCE(r.responses, 0)::int AS responses,
         CASE WHEN COALESCE(r.responses, 0) = 0 THEN NULL
              ELSE round(100.0 * r.good / r.responses)::int END AS score
    FROM specials s
    LEFT JOIN (
      SELECT special_id,
             count(*)                                AS responses,
             count(*) FILTER (WHERE rating = 'good') AS good,
             count(*) FILTER (WHERE rating = 'ok')   AS ok,
             count(*) FILTER (WHERE rating = 'bad')  AS bad
        FROM special_ratings GROUP BY special_id
    ) r ON r.special_id = s.id`;

export function listSpecialsWithResults(): Promise<SpecialWithResults[]> {
  return query<SpecialWithResults>(`${RESULT_SELECT} ORDER BY s.week_start DESC`);
}

export function getSpecialWithResults(id: string): Promise<SpecialWithResults | null> {
  return queryOne<SpecialWithResults>(`${RESULT_SELECT} WHERE s.id = $1`, [id]);
}

/** Create the week's special, or update it if that week already has one. */
export function upsertSpecial(input: {
  storeId: string;
  weekStart: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  status?: string;
}): Promise<{ id: string } | null> {
  return queryOne<{ id: string }>(
    `INSERT INTO specials (store_id, week_start, title, description, image_url, status)
       VALUES ($1, $2::date, $3, $4, $5, $6)
     ON CONFLICT (store_id, week_start) DO UPDATE
       SET title = EXCLUDED.title,
           description = EXCLUDED.description,
           image_url = EXCLUDED.image_url,
           status = EXCLUDED.status,
           updated_at = now()
     RETURNING id`,
    [
      input.storeId,
      input.weekStart,
      input.title,
      input.description ?? null,
      input.imageUrl ?? null,
      input.status ?? "active",
    ]
  );
}
