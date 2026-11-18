"use client";

import { useState } from "react";
import { adminPost } from "@/lib/admin-fetch";
import { useTr } from "../LangProvider";

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
  const tr = useTr();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const empty = !Object.values(texts).some((t) => t.trim());

  async function run() {
    setBusy(true);
    setErr("");
    const res = await adminPost<{ translations: Record<string, string> }>("/api/admin/translate", { texts });
    setBusy(false);
    if (!res.ok || !res.data) return setErr(res.error ?? tr("翻訳できませんでした", "Translation failed"));
    onResult(res.data.translations);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={run}
        disabled={!enabled || busy || empty}
        title={enabled ? tr("日本語の内容から英語欄を入力します", "Fill the English fields from the Japanese text") : tr("有効にするにはサーバーで ANTHROPIC_API_KEY を設定してください", "Set ANTHROPIC_API_KEY on the server to enable")}
      >
        {busy ? tr("翻訳中…", "Translating…") : tr("日本語から自動翻訳", "Auto-translate from Japanese")}
      </button>
      {!enabled && <span className="hint">{tr("未設定（ANTHROPIC_API_KEY）", "Not set up (ANTHROPIC_API_KEY)")}</span>}
      {err && <span className="hint" style={{ color: "var(--danger)" }}>{err}</span>}
    </div>
  );
}
