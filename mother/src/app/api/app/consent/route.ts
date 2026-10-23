import { corsOptions, json, bad, authGuest, type GuestBody } from "@/lib/guest-api";
import { recordConsent, getConsentState, POLICY_VERSION } from "@/lib/guests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const OPTIONS = corsOptions;

type Body = GuestBody & { store_use?: boolean; partner_sharing?: boolean };

/**
 * Record the guest's consent answers. store_use is required to use member
 * features; partner_sharing is optional and can be changed any time.
 *
 * POST /api/app/consent  { store, id_token, store_use?, partner_sharing? }
 */
export async function POST(req: Request) {
  const auth = await authGuest<Body>(req);
  if ("error" in auth) return auth.error;
  const { ctx, body } = auth;

  const answers = {
    store_use: typeof body.store_use === "boolean" ? body.store_use : undefined,
    partner_sharing: typeof body.partner_sharing === "boolean" ? body.partner_sharing : undefined,
  };
  if (answers.store_use === undefined && answers.partner_sharing === undefined) {
    return bad("store_use or partner_sharing is required");
  }

  await recordConsent(ctx.guestId, ctx.storeId, answers);
  const consent = await getConsentState(ctx.guestId, ctx.storeId);
  return json(200, { ok: true, consent, policy_version: POLICY_VERSION });
}
