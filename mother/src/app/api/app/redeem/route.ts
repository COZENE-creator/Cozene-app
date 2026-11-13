import { corsOptions, json, bad, authGuest, consentedMember, type GuestBody } from "@/lib/guest-api";
import { redeemBenefit, getStaffPinHash } from "@/lib/miniapp";
import { verifyPin, pinLocked, notePinFailure, clearPinFailures } from "@/lib/pin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const OPTIONS = corsOptions;

type Body = GuestBody & { benefit?: string; pin?: string };

/**
 * Staff confirm a benefit by typing the store PIN on the guest's phone.
 * Once per guest, enforced by the database.
 *
 * POST /api/app/redeem  { store, id_token, benefit: "first_visit_glass", pin }
 */
export async function POST(req: Request) {
  const auth = await authGuest<Body>(req);
  if ("error" in auth) return auth.error;
  const { ctx, body } = auth;

  const benefitKey = String(body.benefit || "").trim();
  if (!benefitKey) return bad("benefit is required");

  const limiterKey = `${ctx.storeId}:${ctx.guestId}`;
  if (pinLocked(limiterKey)) return json(429, { ok: false, error: "Too many wrong PINs. Try again in 15 minutes." });

  const store = await getStaffPinHash(ctx.storeId);
  if (!store?.staff_pin_hash) return bad("Staff PIN is not set for this store", 409);
  if (!verifyPin(String(body.pin || ""), store.staff_pin_hash)) {
    notePinFailure(limiterKey);
    return json(403, { ok: false, error: "wrong_pin" });
  }
  clearPinFailures(limiterKey);

  const member = await consentedMember(ctx);
  if ("error" in member) return member.error;

  const result = await redeemBenefit({
    storeId: ctx.storeId,
    guestId: ctx.guestId,
    userId: member.userId,
    benefitKey,
  });
  if (!result.ok) return bad(result.error, 409);
  return json(200, { ok: true, benefit: benefitKey, redeemed_at: result.redeemed_at });
}
