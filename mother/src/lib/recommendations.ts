import { query } from "./db";
import type { Translations } from "./miniapp";

/**
 * 本日のおすすめ — dishes the staff write for today (or until removed), shown at
 * the top of the Mini App menu. "Today" is the date in Japan.
 */

export type Recommendation = {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  price_note: string | null;
  image_url: string | null;
  translations: Translations;
  /** YYYY-MM-DD: shown on that day only. Null: shown until removed. */
  show_date: string | null;
  sort_order: number;
};

const COLUMNS = `id, title, description, price::int AS price, price_note, image_url, translations,
  to_char(show_date, 'YYYY-MM-DD') AS show_date, sort_order`;
const TODAY_JST = `(now() AT TIME ZONE 'Asia/Tokyo')::date`;

/** What guests see today. */
export function listTodayRecommendations(storeId: string): Promise<Recommendation[]> {
  return query<Recommendation>(
    `SELECT ${COLUMNS} FROM recommendations
      WHERE store_id = $1 AND (show_date IS NULL OR show_date = ${TODAY_JST})
      ORDER BY sort_order, created_at`,
    [storeId]
  );
}

/** Admin list: everything not in the past (today, future days, and "until removed"). */
export function listUpcomingRecommendations(storeId: string): Promise<Recommendation[]> {
  return query<Recommendation>(
    `SELECT ${COLUMNS} FROM recommendations
      WHERE store_id = $1 AND (show_date IS NULL OR show_date >= ${TODAY_JST})
      ORDER BY show_date NULLS FIRST, sort_order, created_at`,
    [storeId]
  );
}

/** Today's date in Japan, YYYY-MM-DD (default for new recommendations). */
export function todayInJapan(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date());
}

export type RecommendationInput = Omit<Recommendation, "id"> & { id?: string };

export async function upsertRecommendation(storeId: string, r: RecommendationInput): Promise<void> {
  const params = [storeId, r.title, r.description, r.price, r.price_note, r.image_url,
                  JSON.stringify(r.translations), r.show_date, r.sort_order];
  if (r.id) {
    await query(
      `UPDATE recommendations
          SET title = $2, description = $3, price = $4, price_note = $5, image_url = $6,
              translations = $7::jsonb, show_date = $8::date, sort_order = $9, updated_at = now()
        WHERE id = $10 AND store_id = $1`,
      [...params, r.id]
    );
  } else {
    await query(
      `INSERT INTO recommendations (store_id, title, description, price, price_note, image_url,
                                    translations, show_date, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::date, $9)`,
      params
    );
  }
}

export async function deleteRecommendation(storeId: string, id: string): Promise<void> {
  await query(`DELETE FROM recommendations WHERE id = $1 AND store_id = $2`, [id, storeId]);
}
