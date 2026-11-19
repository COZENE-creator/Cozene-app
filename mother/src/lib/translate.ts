import Anthropic from "@anthropic-ai/sdk";

/**
 * Machine translation for the admin "Auto-translate" buttons: Japanese menu and
 * store text → English, via the Claude API. Needs ANTHROPIC_API_KEY; without it
 * the admin types English by hand and everything else works the same.
 */

export class TranslateNotConfigured extends Error {}

export function translateConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const SYSTEM = `You translate text for a restaurant's LINE Mini App (COZENE BASE, a French bistro and wine bar in Tokyo) from Japanese into natural English for guests.

- Dish names: a short English menu name. Keep established French or Italian dish names as they are (e.g. "Jambon blanc", "Bœuf bourguignon") and keep proper nouns and regional names ("Ezo venison", "Echigo Mochi pork").
- Wine names: write the producer and cuvée in their original Latin spelling (e.g. "Weingut Wolf Pinot Gris 2024"), not a translation.
- Text that is already English, French or another Latin-script language: return it unchanged.
- Keep line breaks, numbers, prices and times exactly. Don't add notes, quotes or explanations.`;

/**
 * Translate each value of `texts` (keyed by field name) to English. Returns the
 * same keys; empty inputs come back empty without an API call.
 */
export async function translateToEnglish(texts: Record<string, string>): Promise<Record<string, string>> {
  const keys = Object.keys(texts).filter((k) => texts[k]?.trim());
  if (keys.length === 0) return {};
  if (!translateConfigured()) throw new TranslateNotConfigured("ANTHROPIC_API_KEY is not set");

  const client = new Anthropic();
  const properties = Object.fromEntries(keys.map((k) => [k, { type: "string" }]));
  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    // A refusal is unlikely for menu text; "default" re-runs a declined request
    // on Anthropic's recommended fallback model instead of failing.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: "low",
      format: {
        type: "json_schema",
        schema: { type: "object", properties, required: keys, additionalProperties: false },
      },
    },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content:
          "Translate each value into English. Reply with the same keys.\n\n" +
          JSON.stringify(Object.fromEntries(keys.map((k) => [k, texts[k]])), null, 2),
      },
    ],
  });

  if (response.stop_reason === "refusal") throw new Error("The translation request was declined");
  if (response.stop_reason === "max_tokens") throw new Error("The translation was cut off");
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("No translation returned");
  const parsed = JSON.parse(text.text) as Record<string, unknown>;
  return Object.fromEntries(keys.map((k) => [k, typeof parsed[k] === "string" ? (parsed[k] as string) : ""]));
}
