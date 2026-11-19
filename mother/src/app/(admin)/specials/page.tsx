import Link from "next/link";
import { listSpecialsWithResults, weekStart } from "@/lib/specials";
import SpecialForm from "./SpecialForm";
import { getTr } from "@/lib/lang-server";

export const dynamic = "force-dynamic";

export default async function SpecialsPage() {
  const specials = await listSpecialsWithResults();
  const tr = getTr();
  const thisWeek = weekStart(new Date());
  const current = specials.find((s) => s.week_start === thisWeek) ?? null;

  return (
    <>
      <div className="page-head">
        <div className="titles">
          <h1>{tr("今週のおすすめ", "Weekly special")}</h1>
          <p className="sub">
            {tr(
              "お会計後に表示される画面で、お客様に今週の料理を評価していただきます。結果をもとにフォローメッセージの配信対象を選べます。",
              "Guests rate the week's dish on the screen shown after payment. Use the result to target follow-up messages.",
            )}
          </p>
        </div>
      </div>

      <h2>{current ? tr("今週", "This week") : tr("今週のおすすめを設定", "Set this week's special")}</h2>
      <div className="card pad">
        <SpecialForm weekStart={thisWeek} existing={current} />
      </div>

      <h2>{tr("結果", "Results")}</h2>
      {specials.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="t">{tr("おすすめはまだありません", "No specials yet")}</div>
            <div>{tr("上で今週の料理を設定すると、評価の収集が始まります。", "Set this week's dish above to start collecting ratings.")}</div>
          </div>
        </div>
      ) : (
        <div className="card table-card">
          <table>
            <thead>
              <tr>
                <th>{tr("週", "Week")}</th>
                <th>{tr("料理", "Dish")}</th>
                <th className="num">{tr("良い", "Good")}</th>
                <th className="num">{tr("普通", "OK")}</th>
                <th className="num">{tr("いまいち", "Not good")}</th>
                <th className="num">{tr("回答", "Responses")}</th>
                <th>{tr("評価", "Rating")}</th>
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
                      <span className="muted">{tr("回答なし", "No responses")}</span>
                    ) : (
                      <RatingBar good={s.good} ok={s.ok} bad={s.bad} score={s.score} />
                    )}
                  </td>
                  <td className="num">
                    {s.responses > 0 && (
                      <Link className="btn btn-secondary btn-sm" href={`/push/new?special=${s.id}`}>
                        {tr("評価者にメッセージ", "Message raters")}
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
  const tr = getTr();
  const total = good + ok + bad || 1;
  const pct = (n: number) => `${(100 * n) / total}%`;
  return (
    <div style={{ minWidth: 140 }}>
      <div className="progress" style={{ margin: "0 0 6px" }}>
        <div className="seg-ok" style={{ width: pct(good) }} />
        <div style={{ width: pct(ok), background: "var(--warn)" }} />
        <div className="seg-bad" style={{ width: pct(bad) }} />
      </div>
      <span className="muted">{tr(`「良い」${score}%`, `${score}% Good`)}</span>
    </div>
  );
}
