import { getMenu } from "@/lib/miniapp";
import { adminStoreId } from "@/lib/store-admin";
import { translateConfigured } from "@/lib/translate";
import MenuEditor from "./MenuEditor";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const storeId = await adminStoreId();
  const menu = storeId ? await getMenu(storeId, { includeHidden: true }) : [];

  return (
    <>
      <div className="page-head">
        <div className="titles">
          <h1>Menu</h1>
          <p className="sub">Shown in the Mini App&apos;s Menu tab, no login needed. Hidden items stay here but guests don&apos;t see them. Write in Japanese and add English in each item.</p>
        </div>
      </div>
      <MenuEditor menu={menu} canTranslate={translateConfigured()} />
    </>
  );
}
