import { getStoreProfile } from "@/lib/miniapp";
import { seatLabel } from "@/lib/seat-label";
import { adminStoreId, hasStaffPin, listRedemptions } from "@/lib/store-admin";
import { datetime } from "@/lib/format";
import { translateConfigured } from "@/lib/translate";
import { getTr } from "@/lib/lang-server";
import StoreForm from "./StoreForm";
import PinForm from "./PinForm";
import HoursForm from "./HoursForm";
import { getBusinessHours } from "@/lib/business-hours";

export const dynamic = "force-dynamic";

export default async function StorePage() {
  const tr = getTr();
  const storeId = await adminStoreId();
  const store = storeId ? await getStoreProfile(storeId) : null;
  if (!storeId || !store) {
    return <div className="card"><div className="empty"><div className="t">{tr("店舗が設定されていません", "No store configured")}</div><div>{tr("DEFAULT_STORE_SLUG を設定してください。", "Set DEFAULT_STORE_SLUG.")}</div></div></div>;
  }
  const [pinSet, redemptions, hours] = await Promise.all([hasStaffPin(storeId), listRedemptions(storeId), getBusinessHours(storeId)]);

  return (
    <>
      <div className="page-head">
        <div className="titles">
          <h1>{tr("店舗情報", "Store")}</h1>
          <p className="sub">{tr("ミニアプリのホーム画面に表示される内容です（ログイン不要）。日本語（アプリの標準言語）で入力し、下に英語版を追加してください。店舗ID", "What guests see on the Mini App home page — no login needed. Write in Japanese (the app's default language) and add English below. Store id")} <span className="mono">{store.slug}</span>{tr("。", ".")}</p>
        </div>
      </div>

      <div className="card pad">
        <StoreForm store={store} canTranslate={translateConfigured()} />
      </div>

      <h2>{tr("チェックインの受付時間", "Check-in hours")}</h2>
      <div className="card pad">
        <HoursForm hours={hours} />
      </div>

      <h2>{tr("スタッフPIN", "Staff PIN")}</h2>
      <div className="card pad">
        <PinForm pinSet={pinSet} />
      </div>

      <h2>{tr("グラスワイン1杯サービスの利用履歴", "Free-glass redemptions")}</h2>
      <div className="card table-card">
        <table>
          <thead><tr><th>{tr("日時", "When")}</th><th>{tr("ゲスト", "Guest")}</th><th>{tr("特典", "Benefit")}</th><th>{tr("お席", "Seat")}</th><th className="num">{tr("人数", "Party")}</th></tr></thead>
          <tbody>
            {redemptions.length === 0 && (
              <tr><td colSpan={5}><div className="empty"><div className="t">{tr("まだありません", "None yet")}</div><div>{tr("スタッフがお客様のパスを確認すると、ここに表示されます。", "Redemptions appear here when staff confirm a guest's pass.")}</div></div></td></tr>
            )}
            {redemptions.map((r) => (
              <tr key={r.id}>
                <td className="muted">{datetime(r.redeemed_at)}</td>
                <td className="cell-strong">{r.user_id ? <a href={`/customers/${r.user_id}`}>{r.display_name || tr("ゲスト", "Guest")}</a> : r.display_name || tr("ゲスト", "Guest")}</td>
                <td>{r.benefit_title}</td>
                <td>{r.table_no ? seatLabel(r.table_no, tr) : "—"}</td>
                <td className="num">{r.party_size ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
