"use client";

import { useState } from "react";
import PhotoField from "../../PhotoField";
import { useRouter } from "next/navigation";
import { adminPost } from "@/lib/admin-fetch";
import { money } from "@/lib/format";
import type { Recommendation } from "@/lib/recommendations";
import { useTr } from "../../LangProvider";
import TranslateButton from "../TranslateButton";

type Draft = {
  id?: string;
  title: string;
  description: string;
  price: string;
  price_note: string;
  image_url: string;
  /** "today" = shown on `date` only; "always" = until removed. */
  when: "today" | "always";
  date: string;
  sort_order: string;
  en: { title: string; description: string; price_note: string };
};

const emptyDraft = (today: string, nextOrder: number): Draft => ({
  title: "",
  description: "",
  price: "",
  price_note: "",
  image_url: "",
  when: "today",
  date: today,
  sort_order: String(nextOrder),
  en: { title: "", description: "", price_note: "" },
});

const toDraft = (r: Recommendation, today: string): Draft => ({
  id: r.id,
  title: r.title,
  description: r.description ?? "",
  price: r.price == null ? "" : String(r.price),
  price_note: r.price_note ?? "",
  image_url: r.image_url ?? "",
  when: r.show_date ? "today" : "always",
  date: r.show_date ?? today,
  sort_order: String(r.sort_order),
  en: {
    title: r.translations?.en?.title ?? "",
    description: r.translations?.en?.description ?? "",
    price_note: r.translations?.en?.price_note ?? "",
  },
});

export default function RecommendationsEditor({
  items,
  today,
  canTranslate,
}: {
  items: Recommendation[];
  today: string;
  canTranslate: boolean;
}) {
  const router = useRouter();
  const tr = useTr();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function run(body: Record<string, unknown>, after?: () => void) {
    setBusy(true);
    setErr("");
    const res = await adminPost("/api/admin/recommendations", body);
    setBusy(false);
    if (!res.ok) return setErr(res.error ?? tr("保存できませんでした", "Could not save"));
    after?.();
    router.refresh();
  }

  const save = () =>
    draft &&
    run(
      {
        action: "save",
        id: draft.id,
        title: draft.title,
        description: draft.description,
        price: draft.price.trim(),
        price_note: draft.price_note,
        image_url: draft.image_url,
        show_date: draft.when === "today" ? draft.date : null,
        sort_order: Number(draft.sort_order) || 0,
        translations: { en: draft.en },
      },
      () => setDraft(null)
    );

  const remove = (r: Recommendation) =>
    confirm(tr(`「${r.title}」を削除しますか？`, `Delete "${r.title}"?`)) && run({ action: "delete", id: r.id });

  const whenLabel = (r: Recommendation) =>
    !r.show_date
      ? tr("削除するまで", "Until removed")
      : r.show_date === today
        ? tr("今日だけ", "Today only")
        : r.show_date;

  return (
    <>
      {err && <div className="alert err" style={{ marginBottom: 12 }}>{err}</div>}

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button className="btn btn-primary" onClick={() => setDraft(emptyDraft(today, items.length + 1))}>
          {tr("おすすめを追加", "Add a pick")}
        </button>
      </div>

      <div className="card table-card">
        <table>
          <thead>
            <tr>
              <th>{tr("料理", "Dish")}</th>
              <th className="num">{tr("価格", "Price")}</th>
              <th>{tr("表示", "Shown")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={4}>
                  <div className="empty">
                    <div className="t">{tr("おすすめはまだありません", "No picks yet")}</div>
                    <div>{tr("「おすすめを追加」から今日の一品を登録してください。", "Use \"Add a pick\" to post today's dish.")}</div>
                  </div>
                </td>
              </tr>
            )}
            {items.map((r) => (
              <tr key={r.id}>
                <td>
                  <div className="cell-strong">{r.title}</div>
                  {r.translations?.en?.title && <div className="muted">{tr("英語：", "EN: ")}{r.translations.en.title}</div>}
                  {r.description && <div className="muted">{r.description}</div>}
                </td>
                <td className="num">
                  {r.price != null ? money(r.price) : "—"}
                  {r.price_note && <div className="muted">{r.price_note}</div>}
                </td>
                <td>
                  <span className={`badge plain ${r.show_date && r.show_date !== today ? "neutral" : "ok"}`}>{whenLabel(r)}</span>
                </td>
                <td className="num" style={{ whiteSpace: "nowrap" }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setDraft(toDraft(r, today))}>{tr("編集", "Edit")}</button>{" "}
                  <button className="btn btn-ghost btn-sm" onClick={() => remove(r)}>{tr("削除", "Delete")}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {draft && (
        <div className="modal-backdrop" onClick={() => setDraft(null)}>
          <div className="card pad modal" onClick={(e) => e.stopPropagation()}>
            <div className="card-title">{draft.id ? tr("おすすめを編集", "Edit pick") : tr("おすすめを追加", "Add a pick")}</div>
            <div className="field">
              <label>{tr("料理名", "Dish name")}</label>
              <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder={tr("例：本日の鮮魚のポワレ", "e.g. Pan-seared catch of the day")} autoFocus />
            </div>
            <div className="field">
              <label>{tr("説明", "Description")} <span className="muted">{tr("（任意）", "(optional)")}</span></label>
              <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} style={{ minHeight: 70 }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 90px", gap: 10 }}>
              <div className="field">
                <label>{tr("価格（円）", "Price (¥)")}</label>
                <input inputMode="numeric" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value.replace(/[^\d]/g, "") })} placeholder={tr("空欄＝スタッフにお尋ねください", "Blank = ask staff")} />
              </div>
              <div className="field">
                <label>{tr("価格の補足", "Price note")}</label>
                <input value={draft.price_note} onChange={(e) => setDraft({ ...draft, price_note: e.target.value })} placeholder={tr("例：数量限定", "e.g. Limited")} />
              </div>
              <div className="field">
                <label>{tr("表示順", "Order")}</label>
                <input inputMode="numeric" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: e.target.value.replace(/[^\d]/g, "") })} />
              </div>
            </div>
            <div className="field">
              <label>{tr("写真", "Photo")} <span className="muted">{tr("（任意）", "(optional)")}</span></label>
              <PhotoField value={draft.image_url} onChange={(url) => setDraft((d) => (d ? { ...d, image_url: url } : d))} />
            </div>
            <div className="field">
              <label>{tr("表示する期間", "Show")}</label>
              <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ display: "flex", gap: 6, alignItems: "center", fontWeight: 400 }}>
                  <input type="radio" checked={draft.when === "today"} onChange={() => setDraft({ ...draft, when: "today" })} style={{ width: "auto" }} />
                  {tr("この日だけ", "On this day only")}
                </label>
                <input type="date" value={draft.date} min={today} disabled={draft.when !== "today"} onChange={(e) => setDraft({ ...draft, date: e.target.value })} style={{ width: 170 }} />
                <label style={{ display: "flex", gap: 6, alignItems: "center", fontWeight: 400 }}>
                  <input type="radio" checked={draft.when === "always"} onChange={() => setDraft({ ...draft, when: "always" })} style={{ width: "auto" }} />
                  {tr("削除するまで", "Until removed")}
                </label>
              </div>
            </div>

            <div className="i18n-block">
              <div className="i18n-head">
                <div className="card-title" style={{ margin: 0 }}>{tr("英語版", "English")}</div>
                <TranslateButton
                  enabled={canTranslate}
                  texts={{ title: draft.title, description: draft.description, price_note: draft.price_note }}
                  onResult={(t) => setDraft((d) => (d ? { ...d, en: { ...d.en, ...t } } : d))}
                />
              </div>
              <div className="field">
                <label>{tr("料理名", "Dish name")} <span className="muted">{tr("（英語）", "(English)")}</span></label>
                <input value={draft.en.title} onChange={(e) => setDraft({ ...draft, en: { ...draft.en, title: e.target.value } })} />
              </div>
              <div className="field">
                <label>{tr("説明", "Description")} <span className="muted">{tr("（英語・任意）", "(English, optional)")}</span></label>
                <textarea value={draft.en.description} onChange={(e) => setDraft({ ...draft, en: { ...draft.en, description: e.target.value } })} style={{ minHeight: 60 }} />
              </div>
              <div className="field">
                <label>{tr("価格の補足", "Price note")} <span className="muted">{tr("（英語・任意）", "(English, optional)")}</span></label>
                <input value={draft.en.price_note} onChange={(e) => setDraft({ ...draft, en: { ...draft.en, price_note: e.target.value } })} />
              </div>
            </div>

            {err && <div className="alert err">{err}</div>}
            <div className="form-actions">
              <button className="btn btn-primary" onClick={save} disabled={busy || !draft.title.trim()}>{busy ? tr("保存中…", "Saving…") : tr("保存", "Save")}</button>
              <button className="btn btn-ghost" onClick={() => setDraft(null)}>{tr("キャンセル", "Cancel")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
