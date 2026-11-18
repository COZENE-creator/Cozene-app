import Anthropic from "@anthropic-ai/sdk";
import { guardApi } from "@/lib/auth-server";
import { ok, fail, readJsonBody } from "@/lib/http";
import { getTr } from "@/lib/lang-server";
import { translateToEnglish, TranslateNotConfigured } from "@/lib/translate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Longest single text accepted; menu and store fields are far shorter. */
const MAX_CHARS = 4000;

/**
 * Auto-translate (admin). Body: {texts: {field: "日本語…"}}.
 * Returns {ok: true, translations: {field: "English…"}}.
 */
export async function POST(req: Request) {
  const unauth = guardApi();
  if (unauth) return unauth;
  const tr = getTr();

  let body: { texts?: unknown };
  try {
    body = await readJsonBody(req);
  } catch {
    return fail(tr("リクエストの内容が正しくありません", "invalid body"));
  }
  if (!body.texts || typeof body.texts !== "object") return fail(tr("翻訳するテキストが指定されていません", "texts is required"));

  const texts: Record<string, string> = {};
  for (const [k, v] of Object.entries(body.texts as Record<string, unknown>)) {
    if (!/^[a-z_]{1,40}$/.test(k) || typeof v !== "string") continue;
    if (v.length > MAX_CHARS) return fail(tr(`「${k}」は長すぎるため翻訳できません`, `"${k}" is too long to translate`));
    texts[k] = v;
  }

  try {
    return ok({ translations: await translateToEnglish(texts) });
  } catch (err) {
    if (err instanceof TranslateNotConfigured) {
      return fail(tr("サーバーで自動翻訳が設定されていません（ANTHROPIC_API_KEY）。英語は手入力してください。", "Auto-translate is not set up on the server (ANTHROPIC_API_KEY). Type the English text by hand."), 503);
    }
    console.error("[translate]", err);
    if (err instanceof Anthropic.RateLimitError) return fail(tr("翻訳が混み合っています。1分ほどしてから再度お試しください。", "Translation is busy — try again in a minute."), 503);
    if (err instanceof Anthropic.AuthenticationError) return fail(tr("サーバーの ANTHROPIC_API_KEY が拒否されました。", "The server's ANTHROPIC_API_KEY was rejected."), 502);
    if (err instanceof Anthropic.APIError) return fail(tr(`翻訳できませんでした（${err.status ?? "network"}）。`, `Translation failed (${err.status ?? "network"}).`), 502);
    return fail(tr("翻訳できませんでした。もう一度お試しいただくか、英語を手入力してください。", "Translation failed. Try again, or type the English by hand."), 502);
  }
}
