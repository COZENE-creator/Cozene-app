import { corsOptions, json, bad, authGuest, consentedMember, type GuestBody } from "@/lib/guest-api";
import { checkIn, getMemberSummary, getBenefits } from "@/lib/miniapp";
import { syncFriendship } from "@/lib/guests";
import { getBusinessHours, businessStatus, businessDayStart } from "@/lib/business-hours";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const OPTIONS = corsOptions;

type Body = GuestBody & { table?: string; party_size?: number; raw?: unknown };

/**
 * Seat QR check-in: seat code (from the QR, e.g. C3 / T2), party size, timestamp.
 * Requires store_use consent. Only while the store is open (if the store limits
 * it: error "outside_hours"), and once per guest per business day — a second
 * scan that day updates the same visit (is_new: false). Returns the updated member card + benefits so
 * the client can go straight to the free-glass pass on a first visit.
 *
 * POST /api/app/checkin  { store, id_token, table, party_size }
 */
export async function POST(req: Request) {
  const auth = await authGuest<Body>(req);
  if ("error" in auth) return auth.error;
  const { ctx, body } = auth;

  const tableNo = String(body.table ?? "").trim().slice(0, 16) || null;
  const partySize = body.party_size == null ? null : Number(body.party_size);
  if (partySize !== null && !(Number.isInteger(partySize) && partySize >= 1 && partySize <= 30)) {
    return bad("party_size must be a whole number from 1 to 30");
  }

  const member = await consentedMember(ctx);
  if ("error" in member) return member.error;

  const hours = await getBusinessHours(ctx.storeId);
  const now = businessStatus(hours);
  if (hours.limit_checkin && !now.open) return bad("outside_hours", 409);

  const { visit, isNew } = await checkIn({
    storeId: ctx.storeId,
    userId: member.userId,
    lineUserId: ctx.lineUserId,
    tableNo,
    partySize,
    dayStart: businessDayStart(now.day),
    raw: body.raw,
  });
  const [summary, benefits] = await Promise.all([
    getMemberSummary(ctx.storeId, member.userId),
    getBenefits(ctx.storeId, ctx.guestId, member.userId),
    syncFriendship(member.userId, ctx.lineUserId),
  ]);

  return json(200, { ok: true, visit, is_new: isNew, member: summary, benefits });
}
