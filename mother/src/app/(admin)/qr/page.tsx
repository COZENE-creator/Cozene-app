import { getStoreProfile } from "@/lib/miniapp";
import { adminStoreId } from "@/lib/store-admin";
import { getSeatLayout } from "@/lib/seats";
import { getTr } from "@/lib/lang-server";
import TableQr from "./TableQr";

export const dynamic = "force-dynamic";

export default async function QrPage() {
  const tr = getTr();
  const storeId = await adminStoreId();
  const [store, layout] = storeId ? await Promise.all([getStoreProfile(storeId), getSeatLayout(storeId)]) : [null, null];

  return (
    <>
      <div className="page-head no-print">
        <div className="titles">
          <h1>{tr("お席のQRコード", "Seat QR codes")}</h1>
          <p className="sub">
            {tr(
              "カウンター席・テーブルごとに1つのQRコードです。お客様はLINEのカメラか、ミニアプリの「チェックイン」タブから読み取ります。そのお席でのチェックインが始まり、どの席でご来店されたかが記録されます。印刷して各席に置いてください。",
              "One QR per counter seat and table. Guests scan it with the LINE camera or from the Mini App's Check in tab; check-in starts for that seat and the seat is recorded with the visit. Print and place one at each seat."
            )}
          </p>
        </div>
      </div>
      {store && layout ? (
        <TableQr liffId={process.env.MINIAPP_LIFF_ID ?? ""} storeSlug={store.slug} storeName={store.name} layout={layout} />
      ) : (
        <div className="card"><div className="empty"><div className="t">{tr("店舗が設定されていません", "No store configured")}</div></div></div>
      )}
    </>
  );
}
