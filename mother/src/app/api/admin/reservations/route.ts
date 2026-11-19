import { guardApi } from "@/lib/auth-server";
import { ok, fail, readJsonBody } from "@/lib/http";
import { getTr } from "@/lib/lang-server";
import { adminStoreId } from "@/lib/store-admin";
import { decideReservation, normalizeSettings, saveReservationSettings } from "@/lib/reservations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { action?: string; [k: string]: unknown };

/**
 * Reservations (admin). action:
 *   confirm | decline  {id, message?}  → saves the decision and sends the guest a LINE message
 *   settings           {settings}     → booking hours shown in the Mini App
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

  if (body.action === "confirm" || body.action === "decline") {
    const id = typeof body.id === "string" ? body.id : "";
    const message = typeof body.message === "string" ? body.message : null;
    const result = await decideReservation(storeId, id, body.action === "confirm" ? "confirmed" : "declined", message);
    if (!result.ok) return fail(tr("この予約は変更できません（キャンセル済みなど）", "This reservation can't be changed (e.g. it was cancelled)"), 409);
    return ok({ notified: result.notified, notify_error: result.error ?? null });
  }

  if (body.action === "settings") {
    await saveReservationSettings(storeId, normalizeSettings(body.settings));
    return ok();
  }

  return fail(tr("不明な操作です", "Unknown action"));
}
