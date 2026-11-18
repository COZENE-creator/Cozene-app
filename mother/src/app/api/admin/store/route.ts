import { guardApi } from "@/lib/auth-server";
import { ok, fail, readJsonBody } from "@/lib/http";
import { getTr } from "@/lib/lang-server";
import { adminStoreId, updateStoreProfile } from "@/lib/store-admin";
import { cleanTranslations, TRANSLATABLE } from "@/lib/i18n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = Record<string, unknown>;

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const isUrl = (v: string) => /^https?:\/\/\S+$/i.test(v);
// Photos bundled with the Mini App (web/miniapp/img/…), relative to the page.
const isBundledImage = (v: string) => /^img\/[\w.-]+\.(jpe?g|png|webp)$/i.test(v);

/** Save the store profile shown on the Mini App home page (admin). */
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

  const name = text(body.name);
  if (!name) return fail(tr("店舗名を入力してください", "Store name is required"));

  const themeColor = text(body.theme_color);
  if (themeColor && !/^#[0-9a-f]{6}$/i.test(themeColor)) return fail(tr("ブランドカラーは #7a1f3d の形式で入力してください", "Theme colour must look like #7a1f3d"));

  const photos = (Array.isArray(body.photos) ? body.photos : [])
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean);
  const mapUrl = text(body.map_url);
  if (mapUrl && !isUrl(mapUrl)) return fail(tr(`URLではありません：${mapUrl}`, `Not a URL: ${mapUrl}`));
  const images = [text(body.hero_image_url), ...photos].filter((u): u is string => !!u);
  const badUrl = images.find((u) => !isUrl(u) && !isBundledImage(u));
  if (badUrl) return fail(tr(`URLではありません：${badUrl}`, `Not a URL: ${badUrl}`));

  const storeId = await adminStoreId();
  if (!storeId) return fail(tr("店舗が設定されていません", "No store configured"), 500);

  await updateStoreProfile(storeId, {
    name,
    tagline: text(body.tagline),
    concept: text(body.concept),
    hours: text(body.hours),
    address: text(body.address),
    access: text(body.access),
    phone: text(body.phone),
    map_url: text(body.map_url),
    hero_image_url: text(body.hero_image_url),
    photos,
    theme_color: themeColor,
    translations: cleanTranslations(body.translations, TRANSLATABLE.store),
  });
  return ok();
}
