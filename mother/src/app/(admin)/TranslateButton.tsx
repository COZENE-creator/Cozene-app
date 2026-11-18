"use client";

import { useState } from "react";
import { adminPost } from "@/lib/admin-fetch";

/**
 * "Auto-translate" — sends the Japanese fields to /api/admin/translate and hands
 * the English back to the form. The admin reviews it before saving.
 */
export default function TranslateButton({
  enabled,
  texts,
  onResult,
}: {
  enabled: boolean;
  texts: Record<string, string>;
  onResult: (translations: Record<string, string>) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const empty = !Object.values(texts).some((t) => t.trim());

  async function run() {
    setBusy(true);
    setErr("");
    const res = await adminPost<{ translations: Record<string, string> }>("/api/admin/translate", { texts });
    setBusy(false);
    if (!res.ok || !res.data) return setErr(res.error ?? "Translation failed");
    onResult(res.data.translations);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={run}
        disabled={!enabled || busy || empty}
        title={enabled ? "Fill the English fields from the Japanese text" : "Set ANTHROPIC_API_KEY on the server to enable"}
      >
        {busy ? "Translating…" : "Auto-translate from Japanese"}
      </button>
      {!enabled && <span className="hint">Not set up (ANTHROPIC_API_KEY)</span>}
      {err && <span className="hint" style={{ color: "var(--danger)" }}>{err}</span>}
    </div>
  );
}
