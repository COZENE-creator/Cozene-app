import { corsOptions, json, bad, authGuest, consentedMember, type GuestBody } from "@/lib/guest-api";
import { createReservation, listGuestReservations, cancelByGuest, acceptProposal } from "@/lib/reservations";
import { syncFriendship } from "@/lib/guests";
import { publicBaseUrl } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const OPTIONS = corsOptions;

type Body = GuestBody & {
  action?: "list" | "create" | "cancel" | "accept";
  id?: string;
  date?: string;
  time?: string;
  party_size?: number;
  name?: string;
  phone?: string;
  note?: string;
  lang?: string;
};

/**
 * The guest's reservations (Mini App 予約 tab). Requires store_use consent.
 *
 * POST /api/app/reservations
 *   {action: "list"}
 *   {action: "create", date: "2026-11-20", time: "18:30", party_size, name, phone?, note?, lang}
 *   {action: "cancel", id}   cancel, or turn down a suggested time
 *   {action: "accept", id}   book the time the staff suggested
 * New requests, cancellations and accepted suggestions go to the staff LINE
 * accounts chosen in Mother. Always answers with the guest's current list. Errors are codes the app translates.
 */
export async function POST(req: Request) {
  const auth = await authGuest<Body>(req);
  if ("error" in auth) return auth.error;
  const { ctx, body } = auth;

  const member = await consentedMember(ctx);
  if ("error" in member) return member.error;

  if (body.action === "create") {
    const result = await createReservation({
      storeId: ctx.storeId,
      guestId: ctx.guestId,
      userId: member.userId,
      date: String(body.date ?? ""),
      time: String(body.time ?? ""),
      partySize: Number(body.party_size),
      name: String(body.name ?? ""),
      phone: typeof body.phone === "string" ? body.phone : null,
      note: typeof body.note === "string" ? body.note : null,
      lang: String(body.lang ?? "ja"),
      baseUrl: publicBaseUrl(req),
    });
    if (!result.ok) return bad(result.error);
    // The confirmation goes out over LINE, which needs the guest to be a friend.
    await syncFriendship(member.userId, ctx.lineUserId);
  } else if (body.action === "cancel") {
    if (!(await cancelByGuest(ctx.storeId, ctx.guestId, String(body.id ?? ""), publicBaseUrl(req)))) return bad("not_cancellable", 409);
  } else if (body.action === "accept") {
    if (!(await acceptProposal(ctx.storeId, ctx.guestId, String(body.id ?? ""), publicBaseUrl(req)))) return bad("not_acceptable", 409);
  } else if (body.action && body.action !== "list") {
    return bad("unknown action");
  }

  return json(200, { ok: true, reservations: await listGuestReservations(ctx.storeId, ctx.guestId) });
}
