import { queryOne, resolveStoreId, query } from "@/lib/db";
import { ok, fail, readJsonBody } from "@/lib/http";
import { upsertUserByLineId, upsertIdentity } from "@/lib/identity";
import { createOrder } from "@/lib/square";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
function withCors(res: Response): Response {
  for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
  return res;
}

type Item = { name: string; quantity: number; amount: number };
type Body = {
  store_id?: string;
  user_ref?: string;
  currency?: string;
  items?: Item[];
};

/**
 * In-app order submit (from the LIFF ordering page).
 * Stamps the LINE userId onto the Square order via reference_id so the eventual
 * order.* / payment.* webhooks auto-link back to this customer. Also writes a
 * local `orders` row immediately (source='inapp', user linked).
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = await readJsonBody<Body>(req);
  } catch (err) {
    return withCors(fail("Invalid body: " + String(err)));
  }

  const slug = String(body.store_id || "").trim();
  const userRef = String(body.user_ref || "").trim();
  const items = Array.isArray(body.items) ? body.items : [];
  const currency = body.currency || "JPY";
  if (!slug) return withCors(fail("store_id is required"));
  if (!userRef) return withCors(fail("user_ref is required"));
  if (items.length === 0) return withCors(fail("items is empty"));

  const storeId = await resolveStoreId(slug);
  if (!storeId) return withCors(fail(`Unknown store_id: ${slug}`, 404));

  // Ensure the customer exists and is push-linked.
  const userId = await upsertUserByLineId(storeId, userRef);
  await upsertIdentity(storeId, "liff", userRef, userId);

  const total = items.reduce((s, it) => s + it.amount * it.quantity, 0);

  const store = await queryOne<{ square_location_id: string | null }>(
    "SELECT square_location_id FROM stores WHERE id = $1",
    [storeId]
  );

  // If Square is configured for this store, create the order there too.
  let squareOrderId: string | null = null;
  if (store?.square_location_id && process.env.SQUARE_ACCESS_TOKEN) {
    try {
      const squareOrder = await createOrder({
        locationId: store.square_location_id,
        referenceId: userRef,
        idempotencyKey: `${storeId}:${userRef}:${Date.now()}`,
        lineItems: items.map((it) => ({
          name: it.name,
          quantity: String(it.quantity),
          amount: it.amount,
          currency,
        })),
      });
      squareOrderId = squareOrder?.id ?? null;
    } catch {
      // Non-fatal: record the local order anyway; Square can reconcile later.
    }
  }

  const row = await queryOne<{ id: string }>(
    `INSERT INTO orders
       (store_id, user_id, square_order_id, square_location_id, reference_id, state,
        total_amount, currency, source, ordered_at, raw)
     VALUES ($1, $2, $3, $4, $5, 'OPEN', $6, $7, 'inapp', now(), $8)
     RETURNING id`,
    [
      storeId, userId, squareOrderId, store?.square_location_id ?? null, userRef,
      total, currency, JSON.stringify({ items }),
    ]
  );
  const orderId = row!.id;

  for (const it of items) {
    await query(
      `INSERT INTO order_items (order_id, store_id, name, quantity, unit_amount, total_amount, raw)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [orderId, storeId, it.name, it.quantity, it.amount, it.amount * it.quantity, JSON.stringify(it)]
    );
  }

  return withCors(ok({ order_id: orderId, square_order_id: squareOrderId, total, currency }));
}
