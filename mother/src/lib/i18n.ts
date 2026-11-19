import type { Translations } from "./miniapp";

/**
 * Mini App languages. The first is the default: it lives in the regular
 * columns, the others in each row's `translations` (db/migrations/0004_i18n.sql).
 */
export const LANGUAGES = [
  { code: "ja", label: "日本語" },
  { code: "en", label: "English" },
] as const;

export const DEFAULT_LANGUAGE = LANGUAGES[0].code;
export const EXTRA_LANGUAGES = LANGUAGES.slice(1).map((l) => l.code);

/** Text fields that can be translated, per table. */
export const TRANSLATABLE = {
  store: ["tagline", "concept", "hours", "access", "address", "rewards_text"],
  category: ["label"],
  item: ["name", "description", "price_note"],
  recommendation: ["title", "description", "price_note"],
} as const;

/**
 * Keep only known languages and fields, trimmed, dropping empty values, so a
 * request body can't store arbitrary JSON on the row.
 */
export function cleanTranslations(input: unknown, fields: readonly string[]): Translations {
  const out: Translations = {};
  if (!input || typeof input !== "object") return out;
  for (const lang of EXTRA_LANGUAGES) {
    const src = (input as Record<string, unknown>)[lang];
    if (!src || typeof src !== "object") continue;
    const kept: Record<string, string> = {};
    for (const f of fields) {
      const v = (src as Record<string, unknown>)[f];
      if (typeof v === "string" && v.trim()) kept[f] = v.trim();
    }
    if (Object.keys(kept).length) out[lang] = kept;
  }
  return out;
}
