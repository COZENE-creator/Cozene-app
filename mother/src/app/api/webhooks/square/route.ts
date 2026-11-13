import {
  verifySquareSignature,
  retrieveOrder,
  retrievePayment,
} from "@/lib/square";
import { resolveStoreForSquare } from "@/lib/stores";
import { recordWebhookEvent, markProcessed } from "@/lib/webhooks";
import { upsertSquareOrder, upsertSquarePayment } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SquareEvent = {
  event_id?: string;
  type?: string; // e.g. order.created, payment.updated
  data?: {
    type?: string;
    id?: string;
    object?: {
      order?: { id?: string; location_id?: string };
      payment?: { id?: string; location_id?: string };
      order_created?: { order_id?: string; location_id?: string };
      order_updated?: { order_id?: string; location_id?: string };
    };
  };
};

function json(status: number, obj: unknown) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Square webhook. Webhooks carry only ids, so we fetch canonical order/payment
 * data via the API, then upsert. Idempotent: replays dedup on event_id, and all
 * writes upsert on Square ids.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const signatureOk = verifySquareSignature(raw, req.headers.get("x-square-hmacsha256-signature"));
  if (!signatureOk) return json(401, { ok: false, error: "bad signature" });

  let event: SquareEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    return json(400, { ok: false, error: "bad json" });
  }

  const obj = event.data?.object ?? {};
  const locationId =
    obj.order?.location_id ??
    obj.payment?.location_id ??
    obj.order_created?.location_id ??
    obj.order_updated?.location_id;

  const storeId = await resolveStoreForSquare(locationId);

  const evt = await recordWebhookEvent({
    source: "square",
    eventType: event.type,
    externalId: event.event_id ?? null,
    storeId,
    signatureOk: true,
    payload: event,
  });
  // Ack replays immediately (already handled) and unattributable events.
  if (!evt.firstTime) return json(200, { ok: true, deduped: true });
  if (!storeId) return json(200, { ok: true, note: "no store match; stored raw" });

  try {
    const kind = (event.type ?? "").split(".")[0]; // 'order' | 'payment' | 'refund'
    if (kind === "order") {
      const orderId =
        obj.order?.id ?? obj.order_created?.order_id ?? obj.order_updated?.order_id ?? event.data?.id;
      if (orderId) {
        const order = await retrieveOrder(orderId);
        if (order) await upsertSquareOrder(storeId, order);
      }
    } else if (kind === "payment") {
      const paymentId = obj.payment?.id ?? event.data?.id;
      if (paymentId) {
        const payment = await retrievePayment(paymentId);
        if (payment) await upsertSquarePayment(storeId, payment);
      }
    }
    await markProcessed(evt.id);
  } catch (err) {
    // Leave processed_at NULL so it can be retried; still 200 so Square doesn't spam retries.
    return json(200, { ok: false, error: String(err) });
  }

  return json(200, { ok: true });
}

export function GET() {
  return json(200, { ok: true, service: "square-webhook" });
}
