"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LANG_COOKIE, makeTr, type Lang, type Tr } from "@/lib/lang";

const LangContext = createContext<Lang>("ja");

/** Set in the root layout from the cookie, so client components render in the same language. */
export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export function useLang(): Lang {
  return useContext(LangContext);
}

export function useTr(): Tr {
  const lang = useLang();
  return useMemo(() => makeTr(lang), [lang]);
}

/** 日本語 / EN toggle: saves the choice for a year and re-renders the page. */
export function LangSwitch({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const lang = useLang();
  const router = useRouter();
  const next: Lang = lang === "ja" ? "en" : "ja";

  function change() {
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <button type="button" className={className ?? "btn btn-ghost btn-sm"} style={style} onClick={change} title={next === "en" ? "Switch to English" : "日本語に切り替え"}>
      {next === "en" ? "EN" : "日本語"}
    </button>
  );
}
