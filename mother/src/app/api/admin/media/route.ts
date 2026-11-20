import { guardApi } from "@/lib/auth-server";
import { ok, fail } from "@/lib/http";
import { getTr } from "@/lib/lang-server";
import { adminStoreId } from "@/lib/store-admin";
import { saveMedia, MEDIA_TYPES, MAX_MEDIA_BYTES, type MediaType } from "@/lib/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Upload a photo (admin). The body is the image itself, with its type in
 * Content-Type. Returns { url: "/media/<id>" } to put in an image_url field.
 */
export async function POST(req: Request) {
  const unauth = guardApi();
  if (unauth) return unauth;
  const tr = getTr();

  const type = (req.headers.get("content-type") || "").split(";")[0].trim() as MediaType;
  if (!MEDIA_TYPES.includes(type)) return fail(tr("JPEG・PNG・WebPの画像を選んでください", "Choose a JPEG, PNG or WebP image"));
  const bytes = Buffer.from(await req.arrayBuffer());
  if (bytes.length === 0) return fail(tr("画像が空です", "The image is empty"));
  if (bytes.length > MAX_MEDIA_BYTES) return fail(tr("画像が大きすぎます（8MBまで）", "The image is too large (8 MB max)"), 413);

  const storeId = await adminStoreId();
  if (!storeId) return fail(tr("店舗が設定されていません", "No store configured"), 500);

  return ok({ url: await saveMedia(storeId, type, bytes) });
}
