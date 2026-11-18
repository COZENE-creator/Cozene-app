import { guardApi } from "@/lib/auth-server";
import { ok, fail, readJsonBody } from "@/lib/http";
import { resolveStoreForLine } from "@/lib/stores";
import { getTr } from "@/lib/lang-server";
import { upsertSpecial, weekStart } from "@/lib/specials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  week_start?: string;
  title?: string;
  description?: string;
  image_url?: string;
  status?: string;
};

/** Create or update the special for a given week (admin). */
export async function POST(req: Request) {
  const unauth = guardApi();
  if (unauth) return unauth;
  const tr = getTr();

  let body: Body;
  try {
    body = await readJsonBody<Body>(req);
  } catch {
    return fail(tr("リクエストの形式が正しくありません", "invalid body"));
  }

  const title = String(body.title || "").trim();
  if (!title) return fail(tr("料理名を入力してください", "title is required"));

  const week = String(body.week_start || "").trim() || weekStart(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return fail(tr("週の開始日はYYYY-MM-DD形式で指定してください", "week_start must be YYYY-MM-DD"));

  const storeId = await resolveStoreForLine(undefined);
  if (!storeId) return fail(tr("店舗が設定されていません", "No store configured"), 500);

  const row = await upsertSpecial({
    storeId,
    weekStart: week,
    title,
    description: body.description?.trim() || null,
    imageUrl: body.image_url?.trim() || null,
    status: body.status === "draft" || body.status === "archived" ? body.status : "active",
  });

  return ok({ id: row?.id, week_start: week });
}
