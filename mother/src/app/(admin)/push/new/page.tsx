import { listTags } from "@/lib/queries";
import { listSpecialsWithResults } from "@/lib/specials";
import ComposeForm from "./ComposeForm";

export const dynamic = "force-dynamic";

export default async function ComposePage({
  searchParams,
}: {
  searchParams: { special?: string };
}) {
  const [tags, specials] = await Promise.all([listTags(), listSpecialsWithResults()]);

  // Only specials that actually have feedback can be used as an audience.
  const rated = specials.filter((s) => s.responses > 0);

  return (
    <>
      <div className="page-head">
        <div className="titles">
          <h1>Compose push</h1>
          <p className="sub">Send a LINE message now. Delivery is recorded per recipient.</p>
        </div>
      </div>
      <ComposeForm
        tags={tags.map((t) => ({ id: t.id, label: t.label, usage: t.usage }))}
        specials={rated.map((s) => ({
          id: s.id,
          title: s.title,
          week_start: s.week_start,
          good: s.good,
          ok: s.ok,
          bad: s.bad,
          responses: s.responses,
          score: s.score,
        }))}
        initialSpecialId={searchParams.special ?? null}
      />
    </>
  );
}
