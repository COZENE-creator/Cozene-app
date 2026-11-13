import { getStoreProfile } from "@/lib/miniapp";
import { adminStoreId, hasStaffPin, listRedemptions } from "@/lib/store-admin";
import { datetime } from "@/lib/format";
import StoreForm from "./StoreForm";
import PinForm from "./PinForm";

export const dynamic = "force-dynamic";

export default async function StorePage() {
  const storeId = await adminStoreId();
  const store = storeId ? await getStoreProfile(storeId) : null;
  if (!storeId || !store) {
    return <div className="card"><div className="empty"><div className="t">No store configured</div><div>Set DEFAULT_STORE_SLUG.</div></div></div>;
  }
  const [pinSet, redemptions] = await Promise.all([hasStaffPin(storeId), listRedemptions(storeId)]);

  return (
    <>
      <div className="page-head">
        <div className="titles">
          <h1>Store</h1>
          <p className="sub">What guests see on the Mini App home page — no login needed. Store id <span className="mono">{store.slug}</span>.</p>
        </div>
      </div>

      <div className="card pad">
        <StoreForm store={store} />
      </div>

      <h2>Staff PIN</h2>
      <div className="card pad">
        <PinForm pinSet={pinSet} />
      </div>

      <h2>Free-glass redemptions</h2>
      <div className="card table-card">
        <table>
          <thead><tr><th>When</th><th>Guest</th><th>Benefit</th><th>Table</th><th className="num">Party</th></tr></thead>
          <tbody>
            {redemptions.length === 0 && (
              <tr><td colSpan={5}><div className="empty"><div className="t">None yet</div><div>Redemptions appear here when staff confirm a guest&apos;s pass.</div></div></td></tr>
            )}
            {redemptions.map((r) => (
              <tr key={r.id}>
                <td className="muted">{datetime(r.redeemed_at)}</td>
                <td className="cell-strong">{r.user_id ? <a href={`/customers/${r.user_id}`}>{r.display_name || "Guest"}</a> : r.display_name || "Guest"}</td>
                <td>{r.benefit_title}</td>
                <td>{r.table_no ?? "—"}</td>
                <td className="num">{r.party_size ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
