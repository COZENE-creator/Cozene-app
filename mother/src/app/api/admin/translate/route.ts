import Anthropic from "@anthropic-ai/sdk";
import { guardApi } from "@/lib/auth-server";
import { ok, fail, readJsonBody } from "@/lib/http";
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

  let body: { texts?: unknown };
  try {
    body = await readJsonBody(req);
  } catch {
    return fail("invalid body");
  }
  if (!body.texts || typeof body.texts !== "object") return fail("texts is required");

  const texts: Record<string, string> = {};
  for (const [k, v] of Object.entries(body.texts as Record<string, unknown>)) {
    if (!/^[a-z_]{1,40}$/.test(k) || typeof v !== "string") continue;
    if (v.length > MAX_CHARS) return fail(`"${k}" is too long to translate`);
    texts[k] = v;
  }

  try {
    return ok({ translations: await translateToEnglish(texts) });
  } catch (err) {
    if (err instanceof TranslateNotConfigured) {
      return fail("Auto-translate is not set up on the server (ANTHROPIC_API_KEY). Type the English text by hand.", 503);
    }
    console.error("[translate]", err);
    if (err instanceof Anthropic.RateLimitError) return fail("Translation is busy — try again in a minute.", 503);
    if (err instanceof Anthropic.AuthenticationError) return fail("The server's ANTHROPIC_API_KEY was rejected.", 502);
    if (err instanceof Anthropic.APIError) return fail(`Translation failed (${err.status ?? "network"}).`, 502);
    return fail(err instanceof Error ? err.message : "Translation failed", 502);
  }
}
