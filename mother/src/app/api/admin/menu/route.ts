import { guardApi } from "@/lib/auth-server";
import { ok, fail, readJsonBody } from "@/lib/http";
import { getTr } from "@/lib/lang-server";
import {
  adminStoreId,
  upsertCategory,
  deleteCategory,
  upsertMenuItem,
  deleteMenuItem,
} from "@/lib/store-admin";
import { cleanTranslations, TRANSLATABLE } from "@/lib/i18n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { action?: string; [k: string]: unknown };

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const int = (v: unknown, fallback = 0) => (Number.isFinite(Number(v)) && v !== "" && v != null ? Math.round(Number(v)) : fallback);

/**
 * Menu editing (admin). One endpoint, `action` picks the operation:
 * save_category | delete_category | save_item | delete_item
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
    case "save_category": {
      const label = text(body.label);
      if (!label) return fail(tr("カテゴリ名を入力してください", "Category name is required"));
      // Key is derived once from the label; it stays fixed when the label is renamed.
      const key = text(body.key) ?? (label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || `cat_${Date.now()}`);
      await upsertCategory(storeId, {
        id, key, label, sort_order: int(body.sort_order),
        translations: cleanTranslations(body.translations, TRANSLATABLE.category),
      });
      return ok();
    }
    case "delete_category":
      if (!id) return fail(tr("IDが指定されていません", "id is required"));
      await deleteCategory(storeId, id);
      return ok();
    case "save_item": {
      const name = text(body.name);
      const categoryId = text(body.category_id);
      if (!name) return fail(tr("品目名を入力してください", "Item name is required"));
      if (!categoryId) return fail(tr("カテゴリを選択してください", "Category is required"));
      const price = body.price === "" || body.price == null ? null : int(body.price, NaN);
      if (price !== null && !(price >= 0)) return fail(tr("価格は円単位の整数で入力してください", "Price must be a whole number of yen"));
      const imageUrl = text(body.image_url);
      if (imageUrl && !/^https?:\/\/\S+$/i.test(imageUrl)) return fail(tr("写真はURLで指定してください", "Photo must be a URL"));
      try {
        await upsertMenuItem(storeId, {
          id,
          category_id: categoryId,
          name,
          description: text(body.description),
          price,
          price_note: text(body.price_note),
          image_url: imageUrl,
          sort_order: int(body.sort_order),
          is_available: body.is_available !== false,
          translations: cleanTranslations(body.translations, TRANSLATABLE.item),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return fail(msg === "Unknown category" ? tr("カテゴリが見つかりません", "Unknown category") : msg);
      }
      return ok();
    }
    case "delete_item":
      if (!id) return fail(tr("IDが指定されていません", "id is required"));
      await deleteMenuItem(storeId, id);
      return ok();
    default:
      return fail(tr("不明な操作です", "Unknown action"));
  }
}
