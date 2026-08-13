"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { IconUsers, IconMegaphone, IconSend, IconTag, IconStar } from "../icons";

const NAV = [
  { href: "/customers", label: "Customers", Icon: IconUsers },
  { href: "/push", label: "Campaigns", Icon: IconMegaphone },
  { href: "/push/new", label: "Compose", Icon: IconSend },
  { href: "/specials", label: "Weekly special", Icon: IconStar },
  { href: "/tags", label: "Tags", Icon: IconTag },
];

export default function Sidebar({ admin }: { admin: string }) {
  const pathname = usePathname();
  const router = useRouter();

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

      <div className="section-label">Workspace</div>
      <nav>
        {NAV.map(({ href, label, Icon }) => (
          <Link key={href} href={href} className={`nav-item ${isActive(href) ? "active" : ""}`}>
            <Icon />
            {label}
          </Link>
        ))}
      </nav>

      <div className="spacer" />

      <div className="user">
        <span className="avatar">{admin.slice(0, 1).toUpperCase()}</span>
        <span className="email" title={admin}>{admin}</span>
        <button className="btn btn-ghost btn-sm" onClick={logout} style={{ marginLeft: "auto", color: "var(--ink-muted)" }}>
          Sign out
        </button>
      </div>
    </aside>
  );
}
