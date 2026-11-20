"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { IconUsers, IconMegaphone, IconSend, IconTag, IconStar, IconStore, IconMenu, IconQr, IconSparkle, IconCalendar } from "../icons";
import { LangSwitch, useTr } from "../LangProvider";

const NAV = [
  { href: "/customers", ja: "顧客", en: "Customers", Icon: IconUsers },
  { href: "/push", ja: "配信履歴", en: "Campaigns", Icon: IconMegaphone },
  { href: "/push/new", ja: "メッセージ作成", en: "Compose", Icon: IconSend },
  { href: "/specials", ja: "今週のおすすめ", en: "Weekly special", Icon: IconStar },
  { href: "/tags", ja: "タグ", en: "Tags", Icon: IconTag },
];

// What guests see in the LINE Mini App.
const MINIAPP_NAV = [
  { href: "/store", ja: "店舗情報", en: "Store", Icon: IconStore },
  { href: "/menu", ja: "メニュー", en: "Menu", Icon: IconMenu },
  { href: "/recommendations", ja: "本日のおすすめ", en: "Today's picks", Icon: IconSparkle },
  { href: "/reservations", ja: "予約", en: "Reservations", Icon: IconCalendar },
  { href: "/qr", ja: "お席のQR", en: "Seat QR", Icon: IconQr },
];

export default function Sidebar({ admin, pendingReservations }: { admin: string; pendingReservations: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const tr = useTr();

  function isActive(href: string) {
    if (href === "/push") return pathname === "/push" || /^\/push\/[^/]+$/.test(pathname) && pathname !== "/push/new";
    return pathname === href || pathname.startsWith(href + "/");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="dot">C</span> COZENE
      </div>

      <div className="section-label">{tr("マーケティング", "Workspace")}</div>
      <nav>
        {NAV.map(({ href, ja, en, Icon }) => (
          <Link key={href} href={href} className={`nav-item ${isActive(href) ? "active" : ""}`}>
            <Icon />
            {tr(ja, en)}
          </Link>
        ))}
      </nav>

      <div className="section-label">{tr("ミニアプリ", "Mini App")}</div>
      <nav>
        {MINIAPP_NAV.map(({ href, ja, en, Icon }) => (
          <Link key={href} href={href} className={`nav-item ${isActive(href) ? "active" : ""}`}>
            <Icon />
            {tr(ja, en)}
            {href === "/reservations" && pendingReservations > 0 && (
              <span className="nav-count" title={tr("未対応の予約リクエスト", "Requests waiting for a reply")}>{pendingReservations}</span>
            )}
          </Link>
        ))}
      </nav>

      <div className="spacer" />

      <div style={{ padding: "0 14px 10px" }}>
        <LangSwitch className="btn btn-ghost btn-sm" style={{ color: "var(--ink-muted)" }} />
      </div>

      <div className="user">
        <span className="avatar">{admin.slice(0, 1).toUpperCase()}</span>
        <span className="email" title={admin}>{admin}</span>
        <button className="btn btn-ghost btn-sm" onClick={logout} style={{ marginLeft: "auto", color: "var(--ink-muted)" }}>
          {tr("ログアウト", "Sign out")}
        </button>
      </div>
    </aside>
  );
}
