"use client";

import { useState } from "react";
import { IconCheck } from "../../../icons";

type Tag = { id: string; label: string };

export default function TagAssign({
  userId,
  allTags,
  assigned,
}: {
  userId: string;
  allTags: Tag[];
  assigned: string[];
}) {
  const [current, setCurrent] = useState<Set<string>>(new Set(assigned));
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(tagId: string) {
    const isOn = current.has(tagId);
    setBusy(tagId);
    const res = await fetch("/api/tags/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, tag_id: tagId, action: isOn ? "unassign" : "assign" }),
    });
    const data = await res.json();
    setBusy(null);
    if (data.ok) {
      setCurrent((prev) => {
        const next = new Set(prev);
        if (isOn) next.delete(tagId);
        else next.add(tagId);
        return next;
      });
    }
  }

  if (allTags.length === 0)
    return <div className="muted">No tags defined yet. Create some on the Tags page.</div>;

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {allTags.map((t) => {
        const on = current.has(t.id);
        return (
          <button
            key={t.id}
            className={`chip-toggle ${on ? "on" : ""}`}
            disabled={busy === t.id}
            onClick={() => toggle(t.id)}
          >
            {on ? <IconCheck style={{ width: 14, height: 14 }} /> : "+"} {t.label}
          </button>
        );
      })}
    </div>
  );
}
