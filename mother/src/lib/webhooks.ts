import { queryOne } from "./db";

/**
 * Record a raw webhook event. Returns { firstTime } — false if we've already
 * seen this (source, external_id), so callers can skip reprocessing replays.
 * external_id null (LINE has no per-delivery id) → always treated as new.
 */
export async function recordWebhookEvent(args: {
  source: "line" | "square";
  eventType?: string | null;
  externalId?: string | null;
  storeId?: string | null;
  signatureOk: boolean;
  payload: unknown;
}): Promise<{ id: string; firstTime: boolean }> {
  if (!args.externalId) {
    const row = await queryOne<{ id: string }>(
      `INSERT INTO webhook_events (source, event_type, external_id, store_id, signature_ok, payload)
         VALUES ($1, $2, NULL, $3, $4, $5) RETURNING id`,
      [args.source, args.eventType ?? null, args.storeId ?? null, args.signatureOk,
       JSON.stringify(args.payload)]
    );
    return { id: row!.id, firstTime: true };
  }

  const row = await queryOne<{ id: string; inserted: boolean }>(
    `INSERT INTO webhook_events (source, event_type, external_id, store_id, signature_ok, payload)
       VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (source, external_id) DO UPDATE SET external_id = webhook_events.external_id
     RETURNING id, (xmax = 0) AS inserted`,
    [args.source, args.eventType ?? null, args.externalId, args.storeId ?? null,
     args.signatureOk, JSON.stringify(args.payload)]
  );
  return { id: row!.id, firstTime: row!.inserted };
}

/** Mark a webhook event row processed (best-effort audit trail). */
export async function markProcessed(id: string): Promise<void> {
  await queryOne("UPDATE webhook_events SET processed_at = now() WHERE id = $1", [id]);
}
