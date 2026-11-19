import { guardApi } from "@/lib/auth-server";
import { ok, fail, readJsonBody } from "@/lib/http";
import { getTr } from "@/lib/lang-server";
import { adminStoreId } from "@/lib/store-admin";
import { normalizeHours, saveBusinessHours } from "@/lib/business-hours";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Save the opening hours that limit table check-in (admin). */
export async function POST(req: Request) {
  const unauth = guardApi();
  if (unauth) return unauth;
  const tr = getTr();

  let body: { hours?: unknown };
  try {
    body = await readJsonBody(req);
  } catch {
    return fail(tr("リクエストの内容が正しくありません", "invalid body"));
  }
  const storeId = await adminStoreId();
  if (!storeId) return fail(tr("店舗が設定されていません", "No store configured"), 500);

  await saveBusinessHours(storeId, normalizeHours(body.hours));
  return ok();
}
