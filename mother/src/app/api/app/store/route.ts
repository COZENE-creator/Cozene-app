import { corsOptions, json, bad } from "@/lib/guest-api";
import { getStoreProfileBySlug, getMenu } from "@/lib/miniapp";
import { listTodayRecommendations } from "@/lib/recommendations";
import { getReservationSettings, timeSlots, getCalendar } from "@/lib/reservations";
import { getBusinessHours, businessStatus } from "@/lib/business-hours";

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
  const [menu, recommendations, booking, hours] = await Promise.all([
    getMenu(store.id),
    listTodayRecommendations(store.id),
    getReservationSettings(store.id),
    getBusinessHours(store.id),
  ]);
  const calendar = await getCalendar(store.id, booking, hours);

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
      calendar: calendar.map(({ date, status }) => ({ date, status })),
    },
    // Check-in is only possible while open (when the store limits it).
    checkin: {
      open_now: !hours.limit_checkin || businessStatus(hours).open,
      open: hours.open,
      close: hours.close,
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
