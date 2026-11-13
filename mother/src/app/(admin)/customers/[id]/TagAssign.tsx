"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconCheck } from "../../../icons";
import { toggleTagAction } from "./actions";

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
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [current, setCurrent] = useState<Set<string>>(new Set(assigned));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The server is the source of truth: re-sync when revalidation sends new
  // props, otherwise useState keeps the first render's value and goes stale.
  const assignedKey = assigned.join(",");
  useEffect(() => {
    setCurrent(new Set(assigned));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignedKey]);

  async function toggle(tagId: string) {
    const isOn = current.has(tagId);
    setBusy(tagId);
    setError(null);

    // Optimistic: the chip reacts on click, the action reconciles right after.
    setCurrent((prev) => {
      const next = new Set(prev);
      if (isOn) next.delete(tagId);
      else next.add(tagId);
      return next;
    });

    try {
      const res = await toggleTagAction(userId, tagId, isOn ? "unassign" : "assign");
      if (!res.ok) {
        // Roll back — the write did not happen.
        setCurrent((prev) => {
          const next = new Set(prev);
          if (isOn) next.add(tagId);
          else next.delete(tagId);
          return next;
        });
        setError(res.error);
        if (res.unauthorized) router.push("/login");
        return;
      }
      // revalidatePath in the action already invalidated /customers and /tags;
      // refresh pulls the new payload for this route without a manual reload.
      startTransition(() => router.refresh());
    } catch (err) {
      setCurrent((prev) => {
        const next = new Set(prev);
        if (isOn) next.add(tagId);
        else next.delete(tagId);
        return next;
      });
      setError(`Could not save: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(null);
    }
  }

  if (allTags.length === 0)
    return <div className="muted">No tags defined yet. Create some on the Tags page.</div>;

  return (
    <>
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
      {error && (
        <div className="muted" role="alert" style={{ marginTop: 10, color: "var(--danger, #c0392b)" }}>
          {error}
        </div>
      )}
    </>
  );
}
