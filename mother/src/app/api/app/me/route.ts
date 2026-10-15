import { corsOptions, json, authGuest, type GuestBody } from "@/lib/guest-api";
import { getConsentState, ensureStoreMember, POLICY_VERSION } from "@/lib/guests";
import { getMemberSummary, getBenefits } from "@/lib/miniapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const OPTIONS = corsOptions;

/**
 * Who am I at this store: consent state, and — once consented — the member
 * card (visit count) and benefit status. Called right after login.
 *
 * POST /api/app/me  { store, id_token }
 */
export async function POST(req: Request) {
  const auth = await authGuest<GuestBody>(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;

  const consent = await getConsentState(ctx.guestId, ctx.storeId);
  const guest = { display_name: ctx.displayName, picture_url: ctx.pictureUrl };
  if (consent.needs_consent) {
    return json(200, { ok: true, guest, consent, policy_version: POLICY_VERSION, member: null, benefits: [] });
  }

  const userId = await ensureStoreMember(ctx.storeId, ctx.guestId, ctx.lineUserId, ctx.displayName);
  const [member, benefits] = await Promise.all([
    getMemberSummary(ctx.storeId, userId),
    getBenefits(ctx.storeId, ctx.guestId, userId),
  ]);
  return json(200, { ok: true, guest, consent, policy_version: POLICY_VERSION, member, benefits });
}
