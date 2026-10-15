import { corsOptions, json, bad } from "@/lib/guest-api";
import { getStoreProfileBySlug, getMenu } from "@/lib/miniapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const OPTIONS = corsOptions;

/**
 * Public store page + menu. No login: anyone who opens the Mini App sees it.
 *
 * GET /api/app/store?store=cozene-base
 */
export async function GET(req: Request) {
  const slug = (new URL(req.url).searchParams.get("store") || "").trim();
  if (!slug) return bad("store is required");

  const store = await getStoreProfileBySlug(slug);
  if (!store) return bad(`Unknown store: ${slug}`, 404);
  const menu = await getMenu(store.id);

  const { id: _id, ...publicStore } = store;
  return json(200, {
    ok: true,
    store: publicStore,
    menu: menu.map((c) => ({
      key: c.key,
      label: c.label,
      items: c.items.map(({ id, name, description, price, price_note, image_url }) => ({
        id, name, description, price, price_note, image_url,
      })),
    })),
  });
}
