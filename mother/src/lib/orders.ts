import { query, queryOne } from "./db";
import { resolveUserId } from "./identity";
import type { SquareOrder, SquarePayment } from "./square";

/**
 * Resolve the Cozene user for a Square order via its reference_id (the LINE id
 * the ordering flow stamped on it). Tries messaging then liff scope.
 */
async function linkFromReference(storeId: string, referenceId?: string): Promise<string | null> {
  if (!referenceId) return null;
  return (
    (await resolveUserId(storeId, "messaging", referenceId)) ??
    (await resolveUserId(storeId, "liff", referenceId))
  );
}

/** Upsert a Square order + its line items. Idempotent on (store, square_order_id). */
export async function upsertSquareOrder(storeId: string, order: SquareOrder): Promise<string> {
  const userId = await linkFromReference(storeId, order.reference_id);

  const row = await queryOne<{ id: string }>(
    `INSERT INTO orders
       (store_id, user_id, square_order_id, square_location_id, reference_id, state,
        total_amount, currency, source, ordered_at, closed_at, raw)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'square', $9, $10, $11)
     ON CONFLICT (store_id, square_order_id) DO UPDATE SET
       user_id      = COALESCE(orders.user_id, EXCLUDED.user_id),
       state        = EXCLUDED.state,
       total_amount = EXCLUDED.total_amount,
       currency     = EXCLUDED.currency,
       closed_at    = EXCLUDED.closed_at,
       raw          = EXCLUDED.raw,
       updated_at   = now()
     RETURNING id`,
    [
      storeId, userId, order.id, order.location_id ?? null, order.reference_id ?? null,
      order.state ?? null, order.total_money?.amount ?? null,
      order.total_money?.currency ?? "JPY", order.created_at ?? null, order.closed_at ?? null,
      JSON.stringify(order),
    ]
  );
  const orderId = row!.id;

  for (const li of order.line_items ?? []) {
    await query(
      `INSERT INTO order_items
         (order_id, store_id, square_uid, name, quantity, unit_amount, total_amount, category, raw)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (order_id, square_uid) DO UPDATE SET
         name = EXCLUDED.name, quantity = EXCLUDED.quantity,
         unit_amount = EXCLUDED.unit_amount, total_amount = EXCLUDED.total_amount,
         raw = EXCLUDED.raw`,
      [
        orderId, storeId, li.uid ?? null, li.name ?? null,
        li.quantity ? Number(li.quantity) : null,
        li.base_price_money?.amount ?? null, li.total_money?.amount ?? null,
        li.catalog_object_id ?? null, JSON.stringify(li),
      ]
    );
  }
  return orderId;
}

/** Upsert a Square payment, linking to its order/user when resolvable. */
export async function upsertSquarePayment(storeId: string, payment: SquarePayment): Promise<void> {
  // Find the local order (and its user) this payment belongs to.
  const order = payment.order_id
    ? await queryOne<{ id: string; user_id: string | null }>(
        `SELECT id, user_id FROM orders WHERE store_id = $1 AND square_order_id = $2`,
        [storeId, payment.order_id]
      )
    : null;

  await query(
    `INSERT INTO payments
       (store_id, order_id, user_id, square_payment_id, square_order_id, amount, currency, status, paid_at, raw)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (store_id, square_payment_id) DO UPDATE SET
       order_id = COALESCE(payments.order_id, EXCLUDED.order_id),
       user_id  = COALESCE(payments.user_id, EXCLUDED.user_id),
       amount   = EXCLUDED.amount, currency = EXCLUDED.currency,
       status   = EXCLUDED.status, paid_at = EXCLUDED.paid_at, raw = EXCLUDED.raw`,
    [
      storeId, order?.id ?? null, order?.user_id ?? null, payment.id,
      payment.order_id ?? null, payment.amount_money?.amount ?? null,
      payment.amount_money?.currency ?? "JPY", payment.status ?? null,
      payment.created_at ?? null, JSON.stringify(payment),
    ]
  );
}
