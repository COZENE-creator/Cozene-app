import { query, queryOne } from "./db";
import { normalizeSeatLayout, type SeatLayout } from "./seat-label";

export { normalizeSeatLayout, seatCodes, type SeatLayout } from "./seat-label";

export async function getSeatLayout(storeId: string): Promise<SeatLayout> {
  const row = await queryOne<{ seat_layout: unknown }>(`SELECT seat_layout FROM stores WHERE id = $1`, [storeId]);
  return normalizeSeatLayout(row?.seat_layout);
}

export async function saveSeatLayout(storeId: string, l: SeatLayout): Promise<void> {
  await query(`UPDATE stores SET seat_layout = $2::jsonb, updated_at = now() WHERE id = $1`, [storeId, JSON.stringify(l)]);
}
