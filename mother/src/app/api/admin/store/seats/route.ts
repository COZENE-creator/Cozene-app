import { guardApi } from "@/lib/auth-server";
import { ok, fail, readJsonBody } from "@/lib/http";
import { getTr } from "@/lib/lang-server";
import { adminStoreId } from "@/lib/store-admin";
import { normalizeSeatLayout, saveSeatLayout } from "@/lib/seats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Save the seat layout (counter seats, tables) behind the seat QR codes (admin). */
export async function POST(req: Request) {
  const unauth = guardApi();
  if (unauth) return unauth;
  const tr = getTr();

  let body: { layout?: unknown };
  try {
    body = await readJsonBody(req);
  } catch {
    return fail(tr("リクエストの内容が正しくありません", "invalid body"));
  }
  const storeId = await adminStoreId();
  if (!storeId) return fail(tr("店舗が設定されていません", "No store configured"), 500);

  await saveSeatLayout(storeId, normalizeSeatLayout(body.layout));
  return ok();
}
