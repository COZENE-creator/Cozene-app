"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconTag } from "../../icons";

type Tag = { id: string; key: string; label: string; description: string | null; usage: number };

export default function TagManager({ initialTags }: { initialTags: Tag[] }) {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, label, description }),
    });
    const data = await res.json();
    setBusy(false);
    if (data.ok) {
      setKey(""); setLabel(""); setDescription("");
      router.refresh();
    } else {
      setErr(data.error || "Failed to create tag");
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px minmax(0, 1fr)", gap: 24, alignItems: "start" }}>
      <form className="card pad" onSubmit={create}>
        <div className="card-title">New tag</div>
        <div className="field">
          <label htmlFor="key">Key <span className="muted">(machine name)</span></label>
          <input id="key" value={key} onChange={(e) => setKey(e.target.value)} placeholder="high_spender" />
        </div>
        <div className="field">
          <label htmlFor="label">Label</label>
          <input id="label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="High spender" />
        </div>
        <div className="field">
          <label htmlFor="desc">Description <span className="muted">(optional)</span></label>
          <input id="desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy || !key || !label} style={{ width: "100%" }}>
          {busy ? "Saving…" : "Create tag"}
        </button>
        {err && <div className="alert err">{err}</div>}
      </form>

      <div className="card table-card">
        <table>
          <thead><tr><th>Label</th><th>Key</th><th>Description</th><th className="num">Customers</th></tr></thead>
          <tbody>
            {initialTags.length === 0 && (
              <tr><td colSpan={4}>
                <div className="empty"><IconTag /><div className="t">No tags yet</div><div>Create your first tag to start segmenting.</div></div>
              </td></tr>
            )}
            {initialTags.map((t) => (
              <tr key={t.id}>
                <td><span className="tag-chip">{t.label}</span></td>
                <td className="mono muted">{t.key}</td>
                <td className="muted">{t.description || "—"}</td>
                <td className="num cell-strong">{t.usage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
