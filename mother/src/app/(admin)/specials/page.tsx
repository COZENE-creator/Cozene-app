import Link from "next/link";
import { listSpecialsWithResults, weekStart } from "@/lib/specials";
import SpecialForm from "./SpecialForm";

export const dynamic = "force-dynamic";

export default async function SpecialsPage() {
  const specials = await listSpecialsWithResults();
  const thisWeek = weekStart(new Date());
  const current = specials.find((s) => s.week_start === thisWeek) ?? null;

  return (
    <>
      <div className="page-head">
        <div className="titles">
          <h1>Weekly special</h1>
          <p className="sub">
            Guests rate the week&apos;s dish on the screen shown after payment. Use the result to
            target follow-up messages.
          </p>
        </div>
      </div>

      <h2>{current ? "This week" : "Set this week's special"}</h2>
      <div className="card pad">
        <SpecialForm weekStart={thisWeek} existing={current} />
      </div>

      <h2>Results</h2>
      {specials.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="t">No specials yet</div>
            <div>Set this week&apos;s dish above to start collecting ratings.</div>
          </div>
        </div>
      ) : (
        <div className="card table-card">
          <table>
            <thead>
              <tr>
                <th>Week</th>
                <th>Dish</th>
                <th className="num">Good</th>
                <th className="num">OK</th>
                <th className="num">Not good</th>
                <th className="num">Responses</th>
                <th>Rating</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {specials.map((s) => (
                <tr key={s.id}>
                  <td className="muted">{s.week_start}</td>
                  <td className="cell-strong">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {s.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.image_url}
                          alt=""
                          style={{ width: 38, height: 38, borderRadius: 8, objectFit: "cover", flex: "none" }}
                        />
                      )}
                      <span>{s.title}</span>
                    </div>
                  </td>
                  <td className="num">{s.good}</td>
                  <td className="num">{s.ok}</td>
                  <td className="num">{s.bad}</td>
                  <td className="num">{s.responses}</td>
                  <td>
                    {s.responses === 0 ? (
                      <span className="muted">No responses</span>
                    ) : (
                      <RatingBar good={s.good} ok={s.ok} bad={s.bad} score={s.score} />
                    )}
                  </td>
                  <td className="num">
                    {s.responses > 0 && (
                      <Link className="btn btn-secondary btn-sm" href={`/push/new?special=${s.id}`}>
                        Message raters
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function RatingBar({
  good,
  ok,
  bad,
  score,
}: {
  good: number;
  ok: number;
  bad: number;
  score: number | null;
}) {
  const total = good + ok + bad || 1;
  const pct = (n: number) => `${(100 * n) / total}%`;
  return (
    <div style={{ minWidth: 140 }}>
      <div className="progress" style={{ margin: "0 0 6px" }}>
        <div className="seg-ok" style={{ width: pct(good) }} />
        <div style={{ width: pct(ok), background: "var(--warn)" }} />
        <div className="seg-bad" style={{ width: pct(bad) }} />
      </div>
      <span className="muted">{score}% Good</span>
    </div>
  );
}
