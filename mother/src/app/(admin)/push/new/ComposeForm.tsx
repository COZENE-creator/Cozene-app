"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconSend } from "../../../icons";
import { buildMessage, RATING_LABEL, RATINGS, type Rating } from "@/lib/special-copy";

type Tag = { id: string; label: string; usage: number };
type SpecialResult = {
  id: string;
  title: string;
  week_start: string;
  good: number;
  ok: number;
  bad: number;
  responses: number;
  score: number | null;
};

type AudienceType = "all" | "tag" | "rating";

export default function ComposeForm({
  tags,
  specials,
  initialSpecialId,
}: {
  tags: Tag[];
  specials: SpecialResult[];
  initialSpecialId?: string | null;
}) {
  const router = useRouter();

  // Arriving from "Message raters" on the Specials page preselects that week.
  const preselected = specials.find((s) => s.id === initialSpecialId) ?? null;

  const [title, setTitle] = useState(preselected ? `${preselected.title} follow-up` : "");
  const [body, setBody] = useState("");
  const [audienceType, setAudienceType] = useState<AudienceType>(preselected ? "rating" : "all");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [specialId, setSpecialId] = useState<string>(preselected?.id ?? specials[0]?.id ?? "");
  const [ratings, setRatings] = useState<Rating[]>(["good"]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const special = specials.find((s) => s.id === specialId) ?? null;
  const countFor = (r: Rating) => (special ? special[r] : 0);
  const reach = special ? ratings.reduce((n, r) => n + countFor(r), 0) : 0;

  function toggleTag(id: string) {
    setTagIds((cur) => (cur.includes(id) ? cur.filter((t) => t !== id) : [...cur, id]));
  }

  function toggleRating(r: Rating) {
    setRatings((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));
  }

  /** Turn the week's result into draft copy — editable before sending. */
  function generateFromResult() {
    if (!special) return;
    setBody(buildMessage(special, ratings));
  }

  function audienceSpec() {
    if (audienceType === "tag") return { tag_ids: tagIds };
    if (audienceType === "rating") return { special_id: specialId, ratings };
    return {};
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          audience_type: audienceType,
          audience_spec: audienceSpec(),
        }),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setMsg({ kind: "err", text: data?.error || `Send failed (HTTP ${res.status})` });
        return;
      }
      setMsg({
        kind: "ok",
        text: `Sent to ${data.sent}/${data.recipients} (failed: ${data.failed}). Redirecting…`,
      });
      setTimeout(() => router.push(`/push/${data.campaignId}`), 900);
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }

  const canSend =
    !busy &&
    !!title &&
    !!body &&
    (audienceType !== "rating" || (!!specialId && ratings.length > 0));

  return (
    <div className="two-col">
      <form className="card pad" onSubmit={submit}>
        <div className="field">
          <label htmlFor="title">
            Campaign title <span className="muted">(internal only)</span>
          </label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Weekend special"
          />
        </div>

        <div className="field">
          <label htmlFor="audience">Audience</label>
          <select
            id="audience"
            value={audienceType}
            onChange={(e) => setAudienceType(e.target.value as AudienceType)}
          >
            <option value="all">All friends</option>
            <option value="tag">By tag</option>
            <option value="rating" disabled={specials.length === 0}>
              By weekly special rating{specials.length === 0 ? " (no ratings yet)" : ""}
            </option>
          </select>
        </div>

        {audienceType === "tag" && (
          <div className="field">
            <label>Select tags</label>
            {tags.length === 0 && (
              <div className="muted">No tags yet. Create some on the Tags page.</div>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {tags.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  className={`chip-toggle ${tagIds.includes(t.id) ? "on" : ""}`}
                  onClick={() => toggleTag(t.id)}
                >
                  {t.label} <span className="muted">· {t.usage}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {audienceType === "rating" && (
          <>
            <div className="field">
              <label htmlFor="special">Weekly special</label>
              <select id="special" value={specialId} onChange={(e) => setSpecialId(e.target.value)}>
                {specials.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.week_start} — {s.title} ({s.responses} responses)
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Who rated it</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {RATINGS.map((r) => (
                  <button
                    type="button"
                    key={r}
                    className={`chip-toggle ${ratings.includes(r) ? "on" : ""}`}
                    onClick={() => toggleRating(r)}
                  >
                    {RATING_LABEL[r]} <span className="muted">· {countFor(r)}</span>
                  </button>
                ))}
              </div>
              <div className="hint">
                {ratings.length === 0
                  ? "Pick at least one rating."
                  : `${reach} guest${reach === 1 ? "" : "s"} rated this way (friends only will receive it).`}
              </div>
            </div>
          </>
        )}

        <div className="field">
          <label htmlFor="body">Message</label>
          <textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="The text your customers receive on LINE…"
          />
          <div
            className="hint"
            style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}
          >
            <span>{body.length} characters</span>
            {audienceType === "rating" && special && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={generateFromResult}>
                Draft from result
              </button>
            )}
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={!canSend}>
            <IconSend /> {busy ? "Sending…" : "Send now"}
          </button>
          {msg && (
            <span className={msg.kind === "ok" ? "alert ok" : "alert err"} style={{ marginTop: 0 }}>
              {msg.text}
            </span>
          )}
        </div>
      </form>

      <div className="card pad">
        <div className="card-title">Preview</div>
        <div className="chat" style={{ minHeight: 160 }}>
          <div className="chat-row">
            <div className="chat-av">C</div>
            <div className="chat-msg">
              {body || <span style={{ color: "#aaa" }}>Your message appears here…</span>}
            </div>
          </div>
        </div>
        <div className="hint">Rendered as a LINE text message from your Official Account.</div>

        {audienceType === "rating" && special && (
          <>
            <div className="card-title" style={{ marginTop: 20 }}>
              {special.title}
            </div>
            <div className="kv">
              <span className="k">Good</span>
              <span className="v ok">{special.good}</span>
            </div>
            <div className="kv">
              <span className="k">OK</span>
              <span className="v">{special.ok}</span>
            </div>
            <div className="kv">
              <span className="k">Not good</span>
              <span className="v bad">{special.bad}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
