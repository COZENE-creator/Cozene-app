import { adminStoreId } from "@/lib/store-admin";
import { listUpcomingRecommendations, todayInJapan } from "@/lib/recommendations";
import { translateConfigured } from "@/lib/translate";
import { getTr } from "@/lib/lang-server";
import RecommendationsEditor from "./RecommendationsEditor";

export const dynamic = "force-dynamic";

export default async function RecommendationsPage() {
  const tr = getTr();
  const storeId = await adminStoreId();
  const items = storeId ? await listUpcomingRecommendations(storeId) : [];

  return (
    <>
      <div className="page-head">
        <div className="titles">
          <h1>{tr("本日のおすすめ", "Today's picks")}</h1>
          <p className="sub">{tr(
            "ミニアプリの「メニュー」タブの一番上に表示されます。「今日だけ」はその日の終わり（日本時間）に自動で消え、「削除するまで」は削除するまで毎日表示されます。",
            "Shown at the top of the Mini App's Menu tab. \"Today only\" disappears at the end of the day (Japan time); \"Until removed\" shows every day until you delete it."
          )}</p>
        </div>
      </div>
      <RecommendationsEditor items={items} today={todayInJapan()} canTranslate={translateConfigured()} />
    </>
  );
}
