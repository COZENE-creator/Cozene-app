import { listTags } from "@/lib/queries";
import ComposeForm from "./ComposeForm";

export const dynamic = "force-dynamic";

export default async function ComposePage() {
  const tags = await listTags();
  return (
    <>
      <div className="page-head">
        <div className="titles">
          <h1>Compose push</h1>
          <p className="sub">Send a LINE message now. Delivery is recorded per recipient.</p>
        </div>
      </div>
      <ComposeForm tags={tags.map((t) => ({ id: t.id, label: t.label, usage: t.usage }))} />
    </>
  );
}
