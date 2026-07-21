import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/auth-server";
import Sidebar from "./Sidebar";

export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const admin = currentAdmin();
  if (!admin) redirect("/login");

  return (
    <div className="app-shell">
      <Sidebar admin={admin} />
      <div className="main">
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
