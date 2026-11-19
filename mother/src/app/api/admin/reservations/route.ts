import { guardApi, currentAdmin } from "@/lib/auth-server";
import { ok, fail, readJsonBody, publicBaseUrl } from "@/lib/http";
import { getTr } from "@/lib/lang-server";
import { adminStoreId } from "@/lib/store-admin";
import {
  replyToReservation, normalizeSettings, saveReservationSettings, setAvailability, sendStaffTest,
  replyErrorText, type StaffReply,
} from "@/lib/reservations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { action?: string; [k: string]: unknown };

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/**
 * Reservations (admin). action:
 *   confirm | propose | decline  {id, message?, date?, time?} → reply + the guest's LINE message
 *   availability {day, status: "open" | "few" | "full" | null} → the calendar the Mini App shows
 *   settings     {settings}  → booking hours and the staff LINE accounts that get requests
 *   test_notify              → send a sample request to those staff accounts
 */
export async function POST(req: Request) {
  const unauth = guardApi();
  if (unauth) return unauth;
  const tr = getTr();

  let body: Body;
  try {
    body = await readJsonBody<Body>(req);
  } catch {
    return fail(tr("リクエストの内容が正しくありません", "invalid body"));
  }

  const storeId = await adminStoreId();
  if (!storeId) return fail(tr("店舗が設定されていません", "No store configured"), 500);

  if (body.action === "confirm" || body.action === "propose" || body.action === "decline") {
    const id = str(body.id) ?? "";
    const message = str(body.message);
    const reply: StaffReply =
      body.action === "propose"
        ? { action: "propose", message, date: str(body.date), time: str(body.time) }
        : { action: body.action, message };
    const result = await replyToReservation(storeId, id, reply, currentAdmin());
    if (!result.ok) return fail(replyErrorText(result.error, tr), 409);
    return ok({ notified: result.notified, notify_error: result.error });
  }

  if (body.action === "availability") {
    const day = str(body.day) ?? "";
    const status = body.status === "open" || body.status === "few" || body.status === "full" ? body.status : null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return fail(tr("日付が正しくありません", "Bad date"));
    await setAvailability(storeId, day, status);
    return ok();
  }

  if (body.action === "settings") {
    await saveReservationSettings(storeId, normalizeSettings(body.settings));
    return ok();
  }

  if (body.action === "test_notify") {
    const r = await sendStaffTest(storeId, publicBaseUrl(req));
    if (!r.recipients) return fail(tr("通知先が登録されていません", "No staff accounts are set"));
    if (!r.sent) return fail(tr(`送信できませんでした：${r.failed.join(" / ")}`, `Could not send: ${r.failed.join(" / ")}`));
    return ok({ sent: r.sent, failed: r.failed });
  }

  return fail(tr("不明な操作です", "Unknown action"));
}
