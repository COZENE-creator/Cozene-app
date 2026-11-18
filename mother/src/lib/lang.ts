/**
 * Mother System interface language. Japanese is the default (the system is
 * used in Japan); English is a switch in the sidebar and on the login page,
 * remembered in a cookie.
 *
 * Text lives next to where it is used, as a pair:
 *
 *   tr("顧客", "Customers")
 *
 * Server components and route handlers get `tr` from getTr() (lib/lang-server),
 * client components from useTr() (app/LangProvider).
 */

export type Lang = "ja" | "en";

export const LANG_COOKIE = "cz_lang";
export const DEFAULT_LANG: Lang = "ja";

export function parseLang(value: string | null | undefined): Lang {
  return value === "en" ? "en" : DEFAULT_LANG;
}

/** Returns the Japanese or English text for the current language. */
export type Tr = (ja: string, en: string) => string;

export function makeTr(lang: Lang): Tr {
  return (ja, en) => (lang === "en" ? en : ja);
}
