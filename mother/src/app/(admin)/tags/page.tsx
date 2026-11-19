import { listTags } from "@/lib/queries";
import TagManager from "./TagManager";
import { getTr } from "@/lib/lang-server";

export const dynamic = "force-dynamic";

export default async function TagsPage() {
  const tr = getTr();
  const tags = await listTags();
  return (
    <>
      <div className="page-head">
        <div className="titles">
          <h1>{tr("タグ", "Tags")}</h1>
          <p className="sub">
            {tr(
              "顧客を分類して、対象を絞った配信に使います。現在は手動で付与します。Claudeによる自動タグ付け（フェーズ3）も同じ場所に書き込まれます。",
              "Segment customers for targeted push. Assign them manually now; Claude auto-tagging (Phase 3) writes to the same place."
            )}
          </p>
        </div>
      </div>
      <TagManager
        initialTags={tags.map((t) => ({
          id: t.id,
          key: t.key,
          label: t.label,
          description: t.description,
          usage: t.usage,
        }))}
      />
    </>
  );
}
