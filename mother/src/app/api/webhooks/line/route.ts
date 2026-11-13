import { query } from "@/lib/db";
import { verifyLineSignature, getProfileDisplayName } from "@/lib/line";
import { resolveStoreForLine } from "@/lib/stores";
import { recordWebhookEvent, markProcessed } from "@/lib/webhooks";
import { upsertUserByLineId, upsertIdentity } from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LineEvent = {
  type: string;
  webhookEventId?: string;
  source?: { userId?: string };
};
type LineBody = { destination?: string; events?: LineEvent[] };

/**
 * LINE Messaging API webhook. Captures follow/unfollow so we know who is a
 * pushable friend. Always returns 200 quickly (LINE retries on non-2xx).
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const signatureOk = verifyLineSignature(raw, req.headers.get("x-line-signature"));
  if (!signatureOk) {
    return new Response(JSON.stringify({ ok: false, error: "bad signature" }), { status: 401 });
  }

  let body: LineBody;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "bad json" }), { status: 400 });
  }

  const storeId = await resolveStoreForLine(body.destination);
  const events = body.events ?? [];

  for (const ev of events) {
    const evt = await recordWebhookEvent({
      source: "line",
      eventType: ev.type,
      externalId: ev.webhookEventId ?? null,
      storeId,
      signatureOk: true,
      payload: ev,
    });
    if (!evt.firstTime) continue; // replay — already handled
    if (!storeId) continue; // can't attribute; keep the raw event for debugging

    const userId = ev.source?.userId;
    if (!userId) {
      await markProcessed(evt.id);
      continue;
    }

    if (ev.type === "follow") {
      const displayName = await getProfileDisplayName(userId);
      const uid = await upsertUserByLineId(storeId, userId, { displayName });
      await upsertIdentity(storeId, "messaging", userId, uid);
      await query(
        `UPDATE users SET is_friend = true, followed_at = now(), updated_at = now() WHERE id = $1`,
        [uid]
      );
    } else if (ev.type === "unfollow") {
      const uid = await upsertUserByLineId(storeId, userId);
      await query(
        `UPDATE users SET is_friend = false, unfollowed_at = now(), updated_at = now() WHERE id = $1`,
        [uid]
      );
    }

    await markProcessed(evt.id);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** LINE sends a GET-less verify; expose a simple 200 for manual checks. */
export function GET() {
  return new Response(JSON.stringify({ ok: true, service: "line-webhook" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
