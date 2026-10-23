import { readJsonBody } from "./http";
import { resolveStoreId } from "./db";
import { verifyIdToken, IdTokenError } from "./line-login";
import { upsertGuest, ensureStoreMember, getConsentState } from "./guests";

/**
 * Shared plumbing for the guest-facing Mini App API (/api/app/*).
 *
 * The Mini App is served from another origin (GitHub Pages), so every response
 * carries permissive CORS. Bodies are text/plain JSON to avoid a preflight,
 * like the Phase-1 check-in.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function corsOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export function json(status: number, obj: unknown) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export const bad = (error: string, status = 400) => json(status, { ok: false, error });

export type GuestContext = {
  storeId: string;
  guestId: string;
  lineUserId: string;
  displayName: string | null;
  pictureUrl: string | null;
};

export type GuestBody = { store?: string; id_token?: string };

/**
 * Parse the body, verify the ID token, resolve the store, and upsert the guest.
 * Returns either the context or a ready-made error Response.
 */
export async function authGuest<T extends GuestBody>(
  req: Request
): Promise<{ ctx: GuestContext; body: T } | { error: Response }> {
  let body: T;
  try {
    body = await readJsonBody<T>(req);
  } catch (err) {
    return { error: bad("Invalid request body: " + String(err)) };
  }

  const slug = String(body.store || "").trim();
  if (!slug) return { error: bad("store is required") };
  const storeId = await resolveStoreId(slug);
  if (!storeId) return { error: bad(`Unknown store: ${slug}`, 404) };

  let who;
  try {
    who = await verifyIdToken(String(body.id_token || ""));
  } catch (err) {
    if (err instanceof IdTokenError) return { error: json(401, { ok: false, error: "id_token_invalid", detail: err.message }) };
    // Misconfiguration (e.g. LINE_LOGIN_CHANNEL_IDS unset): still answer with CORS so the client can show it.
    console.error("[guest-api] token verification failed:", err);
    return { error: bad("Login is not configured on the server", 500) };
  }

  const guestId = await upsertGuest(who.userId, { name: who.name, picture: who.picture });
  return {
    body,
    ctx: { storeId, guestId, lineUserId: who.userId, displayName: who.name, pictureUrl: who.picture },
  };
}

/**
 * The per-store user id, but only once the guest has agreed to store data use.
 * Nothing is recorded against a store before consent.
 */
export async function consentedMember(ctx: GuestContext): Promise<{ userId: string } | { error: Response }> {
  const consent = await getConsentState(ctx.guestId, ctx.storeId);
  if (consent.needs_consent) return { error: json(403, { ok: false, error: "consent_required" }) };
  const userId = await ensureStoreMember(ctx.storeId, ctx.guestId, ctx.lineUserId, ctx.displayName);
  return { userId };
}
