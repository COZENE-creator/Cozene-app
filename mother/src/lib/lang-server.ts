import { cookies } from "next/headers";
import { LANG_COOKIE, makeTr, parseLang, type Lang, type Tr } from "./lang";

/** The admin's interface language (server components and route handlers). */
export function getLang(): Lang {
  return parseLang(cookies().get(LANG_COOKIE)?.value);
}

export function getTr(): Tr {
  return makeTr(getLang());
}
