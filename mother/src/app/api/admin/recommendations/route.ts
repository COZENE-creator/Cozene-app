import { guardApi } from "@/lib/auth-server";
import { ok, fail, readJsonBody } from "@/lib/http";
import { getTr } from "@/lib/lang-server";
import { adminStoreId } from "@/lib/store-admin";
import { upsertRecommendation, deleteRecommendation } from "@/lib/recommendations";
import { cleanTranslations, TRANSLATABLE } from "@/lib/i18n";
import { isPhotoUrl } from "@/lib/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { action?: string; [k: string]: unknown };

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const int = (v: unknown, fallback = 0) => (Number.isFinite(Number(v)) && v !== "" && v != null ? Math.round(Number(v)) : fallback);

/**
 * 本日のおすすめ (admin). action: save | delete
 */
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

  const storeId = await adminStoreId();
  if (!storeId) return fail(tr("店舗が設定されていません", "No store configured"), 500);
  const id = text(body.id) ?? undefined;

  switch (body.action) {
    case "save": {
      const title = text(body.title);
      if (!title) return fail(tr("料理名を入力してください", "Dish name is required"));
      const price = body.price === "" || body.price == null ? null : int(body.price, NaN);
      if (price !== null && !(price >= 0)) return fail(tr("価格は円単位の整数で入力してください", "Price must be a whole number of yen"));
      const imageUrl = text(body.image_url);
      if (imageUrl && !isPhotoUrl(imageUrl)) return fail(tr("写真はURLで指定するか、アップロードしてください", "Photo must be a link or an uploaded photo"));
      const showDate = text(body.show_date);
      if (showDate && !/^\d{4}-\d{2}-\d{2}$/.test(showDate)) return fail(tr("日付が正しくありません", "Invalid date"));
      await upsertRecommendation(storeId, {
        id,
        title,
        description: text(body.description),
        price,
        price_note: text(body.price_note),
        image_url: imageUrl,
        translations: cleanTranslations(body.translations, TRANSLATABLE.recommendation),
        show_date: showDate,
        sort_order: int(body.sort_order),
      });
      return ok();
    }
    case "delete":
      if (!id) return fail(tr("IDが指定されていません", "id is required"));
      await deleteRecommendation(storeId, id);
      return ok();
    default:
      return fail(tr("不明な操作です", "Unknown action"));
  }
}
