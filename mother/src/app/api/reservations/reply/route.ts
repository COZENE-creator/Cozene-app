import { ok, fail, readJsonBody } from "@/lib/http";
import { getTr } from "@/lib/lang-server";
import { verifyLink } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { getReservationForStaff, replyToReservation, replyErrorText, type StaffReply } from "@/lib/reservations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { id?: string; u?: string; t?: string; action?: string; message?: string; date?: string; time?: string };

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/**
 * Staff reply from the link in the LINE notification (/r/<id>?u=&t=) — no
 * admin login; the signed link is the permission. Same replies as Mother.
 */
export async function POST(req: Request) {
  const tr = getTr();
  let body: Body;
  try {
    body = await readJsonBody<Body>(req);
  } catch {
    return fail(tr("リクエストの内容が正しくありません", "invalid body"));
  }
  const id = str(body.id) ?? "";
  const staffId = str(body.u) ?? "";
  if (!verifyLink(`resv:${id}:${staffId}`, body.t)) return fail(tr("リンクが正しくありません", "Invalid link"), 403);

  const r = await getReservationForStaff(id);
  if (!r) return fail(tr("予約が見つかりません", "Reservation not found"), 404);
  const staff = await queryOne<{ display_name: string | null }>(
    `SELECT display_name FROM users WHERE id = $1 AND store_id = $2`,
    [staffId, r.store_id]
  );
  if (!staff) return fail(tr("リンクが正しくありません", "Invalid link"), 403);

  const message = str(body.message);
  const action = body.action;
  if (action !== "confirm" && action !== "propose" && action !== "decline") return fail(tr("不明な操作です", "Unknown action"));
  const reply: StaffReply =
    action === "propose"
      ? { action: "propose", message, date: str(body.date), time: str(body.time) }
      : { action, message };
  const result = await replyToReservation(r.store_id, id, reply, `LINE: ${staff.display_name ?? tr("スタッフ", "Staff")}`);
  if (!result.ok) return fail(replyErrorText(result.error, tr), 409);
  return ok({ notified: result.notified, notify_error: result.error });
}
