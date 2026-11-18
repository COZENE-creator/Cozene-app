"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminPost } from "@/lib/admin-fetch";
import type { StoreProfile } from "@/lib/miniapp";
import { TRANSLATABLE } from "@/lib/i18n";
import TranslateButton from "../TranslateButton";

const FIELDS: { key: keyof StoreProfile; label: string; placeholder?: string; multiline?: boolean; hint?: string }[] = [
  { key: "name", label: "Store name" },
  { key: "tagline", label: "Tagline", placeholder: "ワインと小皿料理" },
  { key: "concept", label: "Concept", multiline: true, placeholder: "お店の紹介を数行で。" },
  { key: "hours", label: "Hours", multiline: true, placeholder: "火〜土 17:00–24:00\n月曜定休", hint: "One line per row, shown as written." },
  { key: "access", label: "Access", placeholder: "〇〇駅 2番出口から徒歩3分" },
  { key: "address", label: "Address" },
  { key: "map_url", label: "Map link", placeholder: "https://maps.app.goo.gl/…" },
  { key: "phone", label: "Phone", placeholder: "03-1234-5678" },
  { key: "hero_image_url", label: "Cover photo URL", placeholder: "https://…", hint: "Public https URL, or a photo bundled with the app (img/counter.jpg). Shown at the top of the home page." },
];

const EN_LABEL: Record<string, string> = {
  tagline: "Tagline", concept: "Concept", hours: "Hours", access: "Access", address: "Address",
};
const MULTILINE = new Set(["concept", "hours"]);

export default function StoreForm({ store, canTranslate }: { store: StoreProfile; canTranslate: boolean }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, (store[f.key] as string | null) ?? ""]))
  );
  const [photos, setPhotos] = useState((store.photos ?? []).join("\n"));
  const [theme, setTheme] = useState(store.theme_color ?? "#7a1f3d");
  const [english, setEnglish] = useState<Record<string, string>>(() =>
    Object.fromEntries(TRANSLATABLE.store.map((k) => [k, store.translations?.en?.[k] ?? ""]))
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const set = (k: string, v: string) => setValues((prev) => ({ ...prev, [k]: v }));

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await adminPost("/api/admin/store", {
      ...values,
      theme_color: theme,
      translations: { en: english },
      photos: photos.split("\n").map((p) => p.trim()).filter(Boolean),
    });
    setBusy(false);
    if (!res.ok) return setMsg({ kind: "err", text: res.error ?? "Could not save" });
    setMsg({ kind: "ok", text: "Saved. Guests see the change next time they open the Mini App." });
    router.refresh();
  }

  return (
    <div style={{ maxWidth: 640 }}>
      {FIELDS.map((f) => (
        <div className="field" key={f.key}>
          <label htmlFor={f.key}>{f.label}</label>
          {f.multiline ? (
            <textarea id={f.key} value={values[f.key]} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} style={{ minHeight: 90 }} />
          ) : (
            <input id={f.key} value={values[f.key]} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} />
          )}
          {f.hint && <div className="hint">{f.hint}</div>}
        </div>
      ))}

      <div className="i18n-block">
        <div className="i18n-head">
          <div>
            <div className="card-title" style={{ margin: 0 }}>English version</div>
            <div className="hint">Shown when a guest switches the Mini App to English. Empty fields show the Japanese text.</div>
          </div>
          <TranslateButton
            enabled={canTranslate}
            texts={Object.fromEntries(TRANSLATABLE.store.map((k) => [k, values[k] ?? ""]))}
            onResult={(t) => setEnglish((prev) => ({ ...prev, ...t }))}
          />
        </div>
        {TRANSLATABLE.store.map((k) => (
          <div className="field" key={k}>
            <label htmlFor={`en-${k}`}>{EN_LABEL[k]} <span className="muted">(English)</span></label>
            {MULTILINE.has(k) ? (
              <textarea id={`en-${k}`} value={english[k]} onChange={(e) => setEnglish({ ...english, [k]: e.target.value })} style={{ minHeight: 90 }} />
            ) : (
              <input id={`en-${k}`} value={english[k]} onChange={(e) => setEnglish({ ...english, [k]: e.target.value })} />
            )}
          </div>
        ))}
      </div>

      <div className="field">
        <label htmlFor="photos">Gallery photo URLs</label>
        <textarea id="photos" value={photos} onChange={(e) => setPhotos(e.target.value)} placeholder="One per line: https URL or img/… (bundled)" style={{ minHeight: 90 }} />
      </div>

      <div className="field">
        <label htmlFor="theme">Brand colour</label>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input id="theme" type="color" value={theme} onChange={(e) => setTheme(e.target.value)} style={{ width: 56, padding: 2, height: 38 }} />
          <input value={theme} onChange={(e) => setTheme(e.target.value)} style={{ width: 120 }} />
        </div>
        <div className="hint">Buttons, member card and the free-glass pass use this colour.</div>
      </div>

      <div className="form-actions">
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save store"}</button>
      </div>
      {msg && <div className={`alert ${msg.kind}`}>{msg.text}</div>}
    </div>
  );
}
