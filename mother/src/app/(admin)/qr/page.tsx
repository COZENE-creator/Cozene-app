import { getStoreProfile } from "@/lib/miniapp";
import { adminStoreId } from "@/lib/store-admin";
import TableQr from "./TableQr";

export const dynamic = "force-dynamic";

export default async function QrPage() {
  const storeId = await adminStoreId();
  const store = storeId ? await getStoreProfile(storeId) : null;

  return (
    <>
      <div className="page-head no-print">
        <div className="titles">
          <h1>Table QR codes</h1>
          <p className="sub">
            One QR per table. Scanning opens the Cozene Mini App on this store and starts check-in for
            that table. Print and place one on each table.
          </p>
        </div>
      </div>
      {store ? (
        <TableQr liffId={process.env.MINIAPP_LIFF_ID ?? ""} storeSlug={store.slug} storeName={store.name} />
      ) : (
        <div className="card"><div className="empty"><div className="t">No store configured</div></div></div>
      )}
    </>
  );
}
