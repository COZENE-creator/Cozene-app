"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminPost } from "@/lib/admin-fetch";
import type { StoreProfile } from "@/lib/miniapp";
import { TRANSLATABLE } from "@/lib/i18n";
import TranslateButton from "../TranslateButton";
import { useTr } from "../../LangProvider";

type Text = { ja: string; en: string };

const FIELDS: { key: keyof StoreProfile; label: Text; placeholder?: Text; multiline?: boolean; hint?: Text }[] = [
  { key: "name", label: { ja: "店舗名", en: "Store name" } },
  { key: "tagline", label: { ja: "キャッチコピー", en: "Tagline" }, placeholder: { ja: "ワインと小皿料理", en: "Wine and small plates" } },
  { key: "concept", label: { ja: "コンセプト", en: "Concept" }, multiline: true, placeholder: { ja: "お店の紹介を数行で。", en: "A few lines about the place." } },
  {
    key: "hours",
    label: { ja: "営業時間", en: "Hours" },
    multiline: true,
    placeholder: { ja: "火〜土 17:00–24:00\n月曜定休", en: "Tue–Sat 17:00–24:00\nClosed Mondays" },
    hint: { ja: "1行ずつ、入力したとおりに表示されます。", en: "One line per row, shown as written." },
  },
  { key: "access", label: { ja: "アクセス", en: "Access" }, placeholder: { ja: "〇〇駅 2番出口から徒歩3分", en: "3 min walk from Exit 2, XX Station" } },
  { key: "address", label: { ja: "住所", en: "Address" } },
  { key: "map_url", label: { ja: "地図リンク", en: "Map link" }, placeholder: { ja: "https://maps.app.goo.gl/…", en: "https://maps.app.goo.gl/…" } },
  { key: "phone", label: { ja: "電話番号", en: "Phone" }, placeholder: { ja: "03-1234-5678", en: "03-1234-5678" } },
  {
    key: "rewards_text",
    label: { ja: "会員特典", en: "Member rewards" },
    multiline: true,
    placeholder: {
      ja: "1回目のご来店：グラスワイン1杯\n3回目のご来店：特別なグラスワイン1杯",
      en: "1st visit: a glass of wine\n3rd visit: a glass of our special wine",
    },
    hint: {
      ja: "自由に入力できます。ミニアプリのホームと会員証に、入力したとおりに表示されます。",
      en: "Free text. Shown as written on the Mini App home page and member card.",
    },
  },
  {
    key: "line_friend_url",
    label: { ja: "LINE友だち追加リンク", en: "LINE add-friend link" },
    placeholder: { ja: "https://lin.ee/…", en: "https://lin.ee/…" },
    hint: {
      ja: "LINE公式アカウントの管理画面 →「友だちを増やす」→「友だち追加ガイド」でURLをコピーしてください。ミニアプリに「友だち追加」ボタンが表示されます。",
      en: "Copy it from LINE Official Account Manager → Gain friends → Add friend guide. The Mini App then shows an \"Add friend\" button.",
    },
  },
  {
    key: "hero_image_url",
    label: { ja: "カバー写真URL", en: "Cover photo URL" },
    placeholder: { ja: "https://…", en: "https://…" },
    hint: {
      ja: "公開されているhttpsのURL、またはアプリに同梱の写真（img/counter.jpg）。ホーム画面の一番上に表示されます。",
      en: "Public https URL, or a photo bundled with the app (img/counter.jpg). Shown at the top of the home page.",
    },
  },
];

const EN_LABEL: Record<string, Text> = {
  tagline: { ja: "キャッチコピー", en: "Tagline" },
  concept: { ja: "コンセプト", en: "Concept" },
  hours: { ja: "営業時間", en: "Hours" },
  access: { ja: "アクセス", en: "Access" },
  address: { ja: "住所", en: "Address" },
  rewards_text: { ja: "会員特典", en: "Member rewards" },
};
const MULTILINE = new Set(["concept", "hours", "rewards_text"]);

export default function StoreForm({ store, canTranslate }: { store: StoreProfile; canTranslate: boolean }) {
  const router = useRouter();
  const tr = useTr();
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
    if (!res.ok) return setMsg({ kind: "err", text: res.error ?? tr("保存できませんでした", "Could not save") });
    setMsg({ kind: "ok", text: tr("保存しました。お客様が次にミニアプリを開いたときに反映されます。", "Saved. Guests see the change next time they open the Mini App.") });
    router.refresh();
  }

  return (
    <div style={{ maxWidth: 640 }}>
      {FIELDS.map((f) => (
        <div className="field" key={f.key}>
          <label htmlFor={f.key}>{tr(f.label.ja, f.label.en)}</label>
          {f.multiline ? (
            <textarea id={f.key} value={values[f.key]} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder && tr(f.placeholder.ja, f.placeholder.en)} style={{ minHeight: 90 }} />
          ) : (
            <input id={f.key} value={values[f.key]} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder && tr(f.placeholder.ja, f.placeholder.en)} />
          )}
          {f.hint && <div className="hint">{tr(f.hint.ja, f.hint.en)}</div>}
        </div>
      ))}

      <div className="i18n-block">
        <div className="i18n-head">
          <div>
            <div className="card-title" style={{ margin: 0 }}>{tr("英語版", "English version")}</div>
            <div className="hint">{tr("お客様がミニアプリを英語に切り替えたときに表示されます。空欄の項目は日本語で表示されます。", "Shown when a guest switches the Mini App to English. Empty fields show the Japanese text.")}</div>
          </div>
          <TranslateButton
            enabled={canTranslate}
            texts={Object.fromEntries(TRANSLATABLE.store.map((k) => [k, values[k] ?? ""]))}
            onResult={(t) => setEnglish((prev) => ({ ...prev, ...t }))}
          />
        </div>
        {TRANSLATABLE.store.map((k) => (
          <div className="field" key={k}>
            <label htmlFor={`en-${k}`}>{tr(EN_LABEL[k].ja, EN_LABEL[k].en)} <span className="muted">{tr("（英語）", "(English)")}</span></label>
            {MULTILINE.has(k) ? (
              <textarea id={`en-${k}`} value={english[k]} onChange={(e) => setEnglish({ ...english, [k]: e.target.value })} style={{ minHeight: 90 }} />
            ) : (
              <input id={`en-${k}`} value={english[k]} onChange={(e) => setEnglish({ ...english, [k]: e.target.value })} />
            )}
          </div>
        ))}
      </div>

      <div className="field">
        <label htmlFor="photos">{tr("ギャラリー写真URL", "Gallery photo URLs")}</label>
        <textarea id="photos" value={photos} onChange={(e) => setPhotos(e.target.value)} placeholder={tr("1行に1枚：httpsのURL、または img/…（同梱）", "One per line: https URL or img/… (bundled)")} style={{ minHeight: 90 }} />
      </div>

      <div className="field">
        <label htmlFor="theme">{tr("ブランドカラー", "Brand colour")}</label>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input id="theme" type="color" value={theme} onChange={(e) => setTheme(e.target.value)} style={{ width: 56, padding: 2, height: 38 }} />
          <input value={theme} onChange={(e) => setTheme(e.target.value)} style={{ width: 120 }} />
        </div>
        <div className="hint">{tr("ボタン、会員証、グラスワイン1杯サービスのパスにこの色が使われます。", "Buttons, member card and the free-glass pass use this colour.")}</div>
      </div>

      <div className="form-actions">
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? tr("保存中…", "Saving…") : tr("店舗情報を保存", "Save store")}</button>
      </div>
      {msg && <div className={`alert ${msg.kind}`}>{msg.text}</div>}
    </div>
  );
}
