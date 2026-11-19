import { guardApi } from "@/lib/auth-server";
import { ok, fail, readJsonBody } from "@/lib/http";
import { getTr } from "@/lib/lang-server";
import { adminStoreId, setStaffPin } from "@/lib/store-admin";
import { isValidPin } from "@/lib/pin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Set the staff PIN used to confirm benefits on the guest's phone (admin). */
export async function POST(req: Request) {
  const unauth = guardApi();
  if (unauth) return unauth;
  const tr = getTr();

  let body: { pin?: string };
  try {
    body = await readJsonBody(req);
  } catch {
    return fail(tr("リクエストの内容が正しくありません", "invalid body"));
  }
  const pin = String(body.pin || "").trim();
  if (!isValidPin(pin)) return fail(tr("PINは4〜8桁の数字で入力してください", "PIN must be 4–8 digits"));

  const storeId = await adminStoreId();
  if (!storeId) return fail(tr("店舗が設定されていません", "No store configured"), 500);
  await setStaffPin(storeId, pin);
  return ok();
}
