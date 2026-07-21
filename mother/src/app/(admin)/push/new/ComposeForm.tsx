"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconSend } from "../../../icons";

type Tag = { id: string; label: string; usage: number };

export default function ComposeForm({ tags }: { tags: Tag[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audienceType, setAudienceType] = useState<"all" | "tag">("all");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function toggleTag(id: string) {
    setTagIds((cur) => (cur.includes(id) ? cur.filter((t) => t !== id) : [...cur, id]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        body,
        audience_type: audienceType,
        audience_spec: audienceType === "tag" ? { tag_ids: tagIds } : {},
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (data.ok) {
      setMsg({ kind: "ok", text: `Sent to ${data.sent}/${data.recipients} (failed: ${data.failed}). Redirecting…` });
      setTimeout(() => router.push(`/push/${data.campaignId}`), 900);
    } else {
      setMsg({ kind: "err", text: data.error || "Send failed" });
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 300px", gap: 24, alignItems: "start" }}>
      <form className="card pad" onSubmit={submit}>
        <div className="field">
          <label htmlFor="title">Campaign title <span className="muted">(internal only)</span></label>
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Weekend special" />
        </div>

        <div className="field">
          <label htmlFor="body">Message</label>
          <textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} placeholder="The text your customers receive on LINE…" />
          <div className="hint">{body.length} characters</div>
        </div>

        <div className="field">
          <label htmlFor="audience">Audience</label>
          <select id="audience" value={audienceType} onChange={(e) => setAudienceType(e.target.value as "all" | "tag")}>
            <option value="all">All friends</option>
            <option value="tag">By tag</option>
          </select>
        </div>

        {audienceType === "tag" && (
          <div className="field">
            <label>Select tags</label>
            {tags.length === 0 && <div className="muted">No tags yet. Create some on the Tags page.</div>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {tags.map((t) => (
                <button type="button" key={t.id} className={`chip-toggle ${tagIds.includes(t.id) ? "on" : ""}`} onClick={() => toggleTag(t.id)}>
                  {t.label} <span className="muted">· {t.usage}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={busy || !title || !body}>
            <IconSend /> {busy ? "Sending…" : "Send now"}
          </button>
          {msg && <span className={msg.kind === "ok" ? "alert ok" : "alert err"} style={{ marginTop: 0 }}>{msg.text}</span>}
        </div>
      </form>

      <div className="card pad">
        <div className="card-title">Preview</div>
        <div style={{ background: "#8aabd1", borderRadius: 12, padding: "18px 14px", minHeight: 160 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#06c755", flex: "none", display: "grid", placeItems: "center", color: "#04331d", fontWeight: 800 }}>C</div>
            <div style={{ background: "#fff", borderRadius: "4px 14px 14px 14px", padding: "10px 12px", maxWidth: 200, fontSize: 13.5, lineHeight: 1.5, boxShadow: "0 1px 2px rgba(0,0,0,0.15)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {body || <span style={{ color: "#aaa" }}>Your message appears here…</span>}
            </div>
          </div>
        </div>
        <div className="hint">Rendered as a LINE text message from your Official Account.</div>
      </div>
    </div>
  );
}
