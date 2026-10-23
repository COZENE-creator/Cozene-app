import { guardApi } from "@/lib/auth-server";
import { ok, fail, readJsonBody } from "@/lib/http";
import { adminStoreId, setStaffPin } from "@/lib/store-admin";
import { isValidPin } from "@/lib/pin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Set the staff PIN used to confirm benefits on the guest's phone (admin). */
export async function POST(req: Request) {
  const unauth = guardApi();
  if (unauth) return unauth;

  let body: { pin?: string };
  try {
    body = await readJsonBody(req);
  } catch {
    return fail("invalid body");
  }
  const pin = String(body.pin || "").trim();
  if (!isValidPin(pin)) return fail("PIN must be 4–8 digits");

  const storeId = await adminStoreId();
  if (!storeId) return fail("No store configured", 500);
  await setStaffPin(storeId, pin);
  return ok();
}
