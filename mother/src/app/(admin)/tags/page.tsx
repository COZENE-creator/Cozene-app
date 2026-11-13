import { listTags } from "@/lib/queries";
import TagManager from "./TagManager";

export const dynamic = "force-dynamic";

export default async function TagsPage() {
  const tags = await listTags();
  return (
    <>
      <div className="page-head">
        <div className="titles">
          <h1>Tags</h1>
          <p className="sub">
            Segment customers for targeted push. Assign them manually now; Claude auto-tagging
            (Phase 3) writes to the same place.
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
