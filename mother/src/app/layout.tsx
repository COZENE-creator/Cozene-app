import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { getLang } from "@/lib/lang-server";
import { LangProvider } from "./LangProvider";

export const metadata: Metadata = {
  title: "Cozene Mother System",
  description: "LINE配信と顧客データの管理画面 / Admin console for LINE push and customer data",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const lang = getLang();
  return (
    <html lang={lang}>
      <body>
        <LangProvider lang={lang}>{children}</LangProvider>
      </body>
    </html>
  );
}
