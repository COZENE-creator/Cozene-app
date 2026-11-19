import { corsOptions, json, bad } from "@/lib/guest-api";
import { getStoreProfileBySlug, getMenu } from "@/lib/miniapp";
import { listTodayRecommendations } from "@/lib/recommendations";
import { getReservationSettings, timeSlots } from "@/lib/reservations";

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
  const [menu, recommendations, booking] = await Promise.all([
    getMenu(store.id),
    listTodayRecommendations(store.id),
    getReservationSettings(store.id),
  ]);

  const { id: _id, ...publicStore } = store;
  return json(200, {
    ok: true,
    store: publicStore,
    recommendations: recommendations.map(({ id, title, description, price, price_note, image_url, translations }) => ({
      id, title, description, price, price_note, image_url, translations,
    })),
    reservation: {
      enabled: booking.enabled,
      times: timeSlots(booking),
      max_party: booking.max_party,
      days_ahead: booking.days_ahead,
    },
    menu: menu.map((c) => ({
      key: c.key,
      label: c.label,
      translations: c.translations,
      items: c.items.map(({ id, name, description, price, price_note, image_url, translations }) => ({
        id, name, description, price, price_note, image_url, translations,
      })),
    })),
  });
}
