import { guardApi } from "@/lib/auth-server";
import { ok, fail, readJsonBody } from "@/lib/http";
import {
  adminStoreId,
  upsertCategory,
  deleteCategory,
  upsertMenuItem,
  deleteMenuItem,
} from "@/lib/store-admin";

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

  let body: Body;
  try {
    body = await readJsonBody<Body>(req);
  } catch {
    return fail("invalid body");
  }

  const storeId = await adminStoreId();
  if (!storeId) return fail("No store configured", 500);
  const id = text(body.id) ?? undefined;

  switch (body.action) {
    case "save_category": {
      const label = text(body.label);
      if (!label) return fail("Category name is required");
      // Key is derived once from the label; it stays fixed when the label is renamed.
      const key = text(body.key) ?? (label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || `cat_${Date.now()}`);
      await upsertCategory(storeId, { id, key, label, sort_order: int(body.sort_order) });
      return ok();
    }
    case "delete_category":
      if (!id) return fail("id is required");
      await deleteCategory(storeId, id);
      return ok();
    case "save_item": {
      const name = text(body.name);
      const categoryId = text(body.category_id);
      if (!name) return fail("Item name is required");
      if (!categoryId) return fail("Category is required");
      const price = body.price === "" || body.price == null ? null : int(body.price, NaN);
      if (price !== null && !(price >= 0)) return fail("Price must be a whole number of yen");
      const imageUrl = text(body.image_url);
      if (imageUrl && !/^https?:\/\/\S+$/i.test(imageUrl)) return fail("Photo must be a URL");
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
        });
      } catch (err) {
        return fail(err instanceof Error ? err.message : String(err));
      }
      return ok();
    }
    case "delete_item":
      if (!id) return fail("id is required");
      await deleteMenuItem(storeId, id);
      return ok();
    default:
      return fail("Unknown action");
  }
}
