import { guardApi } from "@/lib/auth-server";
import { ok, fail, readJsonBody } from "@/lib/http";
import { adminStoreId, updateStoreProfile } from "@/lib/store-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = Record<string, unknown>;

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const isUrl = (v: string) => /^https?:\/\/\S+$/i.test(v);

/** Save the store profile shown on the Mini App home page (admin). */
export async function POST(req: Request) {
  const unauth = guardApi();
  if (unauth) return unauth;

  let body: Body;
  try {
    body = await readJsonBody<Body>(req);
  } catch {
    return fail("invalid body");
  }

  const name = text(body.name);
  if (!name) return fail("Store name is required");

  const themeColor = text(body.theme_color);
  if (themeColor && !/^#[0-9a-f]{6}$/i.test(themeColor)) return fail("Theme colour must look like #7a1f3d");

  const photos = (Array.isArray(body.photos) ? body.photos : [])
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean);
  const urls = [text(body.map_url), text(body.hero_image_url), ...photos].filter((u): u is string => !!u);
  const badUrl = urls.find((u) => !isUrl(u));
  if (badUrl) return fail(`Not a URL: ${badUrl}`);

  const storeId = await adminStoreId();
  if (!storeId) return fail("No store configured", 500);

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
  });
  return ok();
}
