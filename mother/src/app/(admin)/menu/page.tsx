import { getMenu } from "@/lib/miniapp";
import { adminStoreId } from "@/lib/store-admin";
import { translateConfigured } from "@/lib/translate";
import { getTr } from "@/lib/lang-server";
import MenuEditor from "./MenuEditor";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const tr = getTr();
  const storeId = await adminStoreId();
  const menu = storeId ? await getMenu(storeId, { includeHidden: true }) : [];

  return (
    <>
      <div className="page-head">
        <div className="titles">
          <h1>{tr("メニュー", "Menu")}</h1>
          <p className="sub">{tr(
            "ミニアプリの「メニュー」タブに表示されます（ログイン不要）。非表示の品目はここに残りますが、お客様には表示されません。日本語で入力し、各品目に英語版を追加してください。",
            "Shown in the Mini App's Menu tab, no login needed. Hidden items stay here but guests don't see them. Write in Japanese and add English in each item."
          )}</p>
        </div>
      </div>
      <MenuEditor menu={menu} canTranslate={translateConfigured()} />
    </>
  );
}
