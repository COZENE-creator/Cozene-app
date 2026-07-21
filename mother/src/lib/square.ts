import crypto from "crypto";

// Square API client + webhook signature verification.
// Sandbox vs production is selected by SQUARE_ENVIRONMENT.

const SQUARE_VERSION = "2024-06-04";

function apiBase(): string {
  return process.env.SQUARE_ENVIRONMENT === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
}

function token(): string {
  const t = process.env.SQUARE_ACCESS_TOKEN;
  if (!t) throw new Error("SQUARE_ACCESS_TOKEN is not set");
  return t;
}

/**
 * Verify the Square webhook signature.
 * Square signs base64(HMAC-SHA256(signatureKey, notificationUrl + rawBody)).
 * The notification URL must EXACTLY match what's configured in Square
 * (provide it via SQUARE_WEBHOOK_URL).
 */
export function verifySquareSignature(rawBody: string, signature: string | null): boolean {
  const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  const url = process.env.SQUARE_WEBHOOK_URL;
  if (!key || !url || !signature) return false;
  const expected = crypto.createHmac("sha256", key).update(url + rawBody).digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

async function squareGet<T>(path: string): Promise<T | null> {
  const res = await fetch(`${apiBase()}${path}`, {
    headers: {
      Authorization: `Bearer ${token()}`,
      "Square-Version": SQUARE_VERSION,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

async function squarePost<T>(path: string, body: unknown): Promise<T | null> {
  const res = await fetch(`${apiBase()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Square-Version": SQUARE_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

// ─── Types (only the fields we consume) ───────────────────────────────────
export type SquareMoney = { amount?: number; currency?: string };
export type SquareLineItem = {
  uid?: string;
  name?: string;
  quantity?: string;
  base_price_money?: SquareMoney;
  total_money?: SquareMoney;
  catalog_object_id?: string;
};
export type SquareOrder = {
  id: string;
  location_id?: string;
  reference_id?: string;
  state?: string;
  total_money?: SquareMoney;
  created_at?: string;
  closed_at?: string;
  line_items?: SquareLineItem[];
};
export type SquarePayment = {
  id: string;
  order_id?: string;
  location_id?: string;
  amount_money?: SquareMoney;
  status?: string;
  created_at?: string;
};

export function retrieveOrder(orderId: string) {
  return squareGet<{ order?: SquareOrder }>(`/v2/orders/${orderId}`).then((r) => r?.order ?? null);
}

export function retrievePayment(paymentId: string) {
  return squareGet<{ payment?: SquarePayment }>(`/v2/payments/${paymentId}`).then(
    (r) => r?.payment ?? null
  );
}

/**
 * Create an order in Square with `reference_id` set to the LINE userId so the
 * resulting order.* webhook auto-links back to the Cozene customer. Used by the
 * in-app ordering flow (M5).
 */
export function createOrder(input: {
  locationId: string;
  referenceId: string;
  idempotencyKey: string;
  lineItems: { name: string; quantity: string; amount: number; currency: string }[];
}) {
  return squarePost<{ order?: SquareOrder }>(`/v2/orders`, {
    idempotency_key: input.idempotencyKey,
    order: {
      location_id: input.locationId,
      reference_id: input.referenceId,
      line_items: input.lineItems.map((li) => ({
        name: li.name,
        quantity: li.quantity,
        base_price_money: { amount: li.amount, currency: li.currency },
      })),
    },
  }).then((r) => r?.order ?? null);
}
