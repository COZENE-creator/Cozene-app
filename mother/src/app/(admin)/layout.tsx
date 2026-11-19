import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/auth-server";
import { adminStoreId } from "@/lib/store-admin";
import { countPendingReservations } from "@/lib/reservations";
import Sidebar from "./Sidebar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = currentAdmin();
  if (!admin) redirect("/login");
  const storeId = await adminStoreId();
  const pendingReservations = storeId ? await countPendingReservations(storeId) : 0;

  return (
    <div className="app-shell">
      <Sidebar admin={admin} pendingReservations={pendingReservations} />
      <div className="main">
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
