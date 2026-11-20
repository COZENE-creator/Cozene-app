"use client";

import { useState } from "react";
import PhotoField from "../../PhotoField";
import { useRouter } from "next/navigation";
import { adminPost } from "@/lib/admin-fetch";
import { money } from "@/lib/format";
import type { MenuCategory, MenuItem } from "@/lib/miniapp";
import TranslateButton from "../TranslateButton";
import { useTr } from "../../LangProvider";

type Draft = {
  id?: string;
  category_id: string;
  name: string;
  description: string;
  price: string;
  price_note: string;
  image_url: string;
  sort_order: string;
  is_available: boolean;
  /** English version; empty fields fall back to the Japanese ones. */
  en: { name: string; description: string; price_note: string };
};

type CatDraft = { id?: string; label: string; en_label: string; sort_order: string };

const emptyEn = { name: "", description: "", price_note: "" };

const emptyDraft = (categoryId: string, nextOrder: number): Draft => ({
  category_id: categoryId,
  name: "",
  description: "",
  price: "",
  price_note: "",
  image_url: "",
  sort_order: String(nextOrder),
  is_available: true,
  en: { ...emptyEn },
});

const toDraft = (i: MenuItem): Draft => ({
  id: i.id,
  category_id: i.category_id,
  name: i.name,
  description: i.description ?? "",
  price: i.price == null ? "" : String(i.price),
  price_note: i.price_note ?? "",
  image_url: i.image_url ?? "",
  sort_order: String(i.sort_order),
  is_available: i.is_available,
  en: {
    name: i.translations?.en?.name ?? "",
    description: i.translations?.en?.description ?? "",
    price_note: i.translations?.en?.price_note ?? "",
  },
});

/** Request body for save_item. */
const itemPayload = ({ en, ...d }: Draft) => ({
  action: "save_item",
  ...d,
  price: d.price.trim(),
  translations: { en },
});

const toCatDraft = (c: MenuCategory): CatDraft => ({
  id: c.id,
  label: c.label,
  en_label: c.translations?.en?.label ?? "",
  sort_order: String(c.sort_order),
});

export default function MenuEditor({ menu, canTranslate }: { menu: MenuCategory[]; canTranslate: boolean }) {
  const router = useRouter();
  const tr = useTr();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [catDraft, setCatDraft] = useState<CatDraft | null>(null);
  const [newCat, setNewCat] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function run(body: Record<string, unknown>, after?: () => void) {
    setBusy(true);
    setErr("");
    const res = await adminPost("/api/admin/menu", body);
    setBusy(false);
    if (!res.ok) return setErr(res.error ?? tr("保存できませんでした", "Could not save"));
    after?.();
    router.refresh();
  }

  const saveItem = () => draft && run(itemPayload(draft), () => setDraft(null));

  const toggle = (i: MenuItem) => run(itemPayload({ ...toDraft(i), is_available: !i.is_available }));

  const saveCategory = () =>
    catDraft &&
    run(
      {
        action: "save_category",
        id: catDraft.id,
        label: catDraft.label,
        sort_order: Number(catDraft.sort_order) || 0,
        translations: { en: { label: catDraft.en_label } },
      },
      () => setCatDraft(null)
    );

  const removeItem = (i: MenuItem) => confirm(tr(`「${i.name}」を削除しますか？`, `Delete "${i.name}"?`)) && run({ action: "delete_item", id: i.id });

  const removeCategory = (c: MenuCategory) =>
    confirm(tr(`「${c.label}」とその${c.items.length}品目を削除しますか？`, `Delete "${c.label}" and its ${c.items.length} items?`)) && run({ action: "delete_category", id: c.id });

  const addCategory = () =>
    newCat.trim() &&
    run({ action: "save_category", label: newCat, sort_order: menu.length + 1 }, () => setNewCat(""));

  return (
    <>
      {err && <div className="alert err" style={{ marginBottom: 12 }}>{err}</div>}

      {menu.map((c) => (
        <div key={c.id}>
          <h2 style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {c.label}
            {c.translations?.en?.label && <span className="muted" style={{ fontWeight: 400 }}>{c.translations.en.label}</span>}
            <span className="muted" style={{ fontWeight: 400 }}>· {tr(`${c.items.length}品`, `${c.items.length} items`)}</span>
            <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setCatDraft(toCatDraft(c))}>{tr("名前を変更", "Rename")}</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setDraft(emptyDraft(c.id, c.items.length + 1))}>{tr("品目を追加", "Add item")}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => removeCategory(c)}>{tr("カテゴリを削除", "Delete category")}</button>
            </span>
          </h2>
          <div className="card table-card">
            <table>
              <thead><tr><th>{tr("品目", "Item")}</th><th className="num">{tr("価格", "Price")}</th><th>{tr("表示", "Shown")}</th><th></th></tr></thead>
              <tbody>
                {c.items.length === 0 && (
                  <tr><td colSpan={4}><div className="empty"><div>{tr("品目がありません。お客様には「スタッフにお尋ねください」と表示されます。", "No items. Guests see \"Ask our staff\".")}</div></div></td></tr>
                )}
                {c.items.map((i) => (
                  <tr key={i.id} style={i.is_available ? undefined : { opacity: 0.55 }}>
                    <td>
                      <div className="cell-strong">{i.name}</div>
                      {i.translations?.en?.name && <div className="muted">{tr("英語：", "EN: ")}{i.translations.en.name}</div>}
                      {i.description && <div className="muted">{i.description}</div>}
                    </td>
                    <td className="num">
                      {i.price != null ? money(i.price) : "—"}
                      {i.price_note && <div className="muted">{i.price_note}</div>}
                    </td>
                    <td>
                      <button className={`badge plain ${i.is_available ? "ok" : "neutral"}`} style={{ border: 0, cursor: "pointer" }} onClick={() => toggle(i)} disabled={busy}>
                        {i.is_available ? tr("表示中", "Shown") : tr("非表示", "Hidden")}
                      </button>
                    </td>
                    <td className="num" style={{ whiteSpace: "nowrap" }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setDraft(toDraft(i))}>{tr("編集", "Edit")}</button>{" "}
                      <button className="btn btn-ghost btn-sm" onClick={() => removeItem(i)}>{tr("削除", "Delete")}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <h2>{tr("新しいカテゴリ", "New category")}</h2>
      <div className="card pad" style={{ display: "flex", gap: 10, maxWidth: 520 }}>
        <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder={tr("例：チーズ、ソフトドリンク", "e.g. Cheese, Soft drinks")} />
        <button className="btn btn-primary" onClick={addCategory} disabled={busy || !newCat.trim()}>{tr("追加", "Add")}</button>
      </div>

      {draft && (
        <div className="modal-backdrop" onClick={() => setDraft(null)}>
          <div className="card pad modal" onClick={(e) => e.stopPropagation()}>
            <div className="card-title">{draft.id ? tr("品目を編集", "Edit item") : tr("新しい品目", "New item")}</div>
            <div className="field">
              <label>{tr("カテゴリ", "Category")}</label>
              <select value={draft.category_id} onChange={(e) => setDraft({ ...draft, category_id: e.target.value })}>
                {menu.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>{tr("名前", "Name")}</label>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
            </div>
            <div className="field">
              <label>{tr("説明", "Description")}</label>
              <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} style={{ minHeight: 70 }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 90px", gap: 10 }}>
              <div className="field">
                <label>{tr("価格（円）", "Price (¥)")}</label>
                <input inputMode="numeric" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value.replace(/[^\d]/g, "") })} placeholder={tr("空欄＝スタッフにお尋ねください", "Blank = ask staff")} />
              </div>
              <div className="field">
                <label>{tr("価格の補足", "Price note")}</label>
                <input value={draft.price_note} onChange={(e) => setDraft({ ...draft, price_note: e.target.value })} placeholder={tr("グラス 90ml", "Glass, 90ml")} />
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
            <div className="i18n-block">
              <div className="i18n-head">
                <div className="card-title" style={{ margin: 0 }}>{tr("英語版", "English")}</div>
                <TranslateButton
                  enabled={canTranslate}
                  texts={{ name: draft.name, description: draft.description, price_note: draft.price_note }}
                  onResult={(t) => setDraft((d) => (d ? { ...d, en: { ...d.en, ...t } } : d))}
                />
              </div>
              <div className="field">
                <label>{tr("名前", "Name")} <span className="muted">{tr("（英語）", "(English)")}</span></label>
                <input value={draft.en.name} onChange={(e) => setDraft({ ...draft, en: { ...draft.en, name: e.target.value } })} />
              </div>
              <div className="field">
                <label>{tr("説明", "Description")} <span className="muted">{tr("（英語・任意）", "(English, optional)")}</span></label>
                <textarea value={draft.en.description} onChange={(e) => setDraft({ ...draft, en: { ...draft.en, description: e.target.value } })} style={{ minHeight: 60 }} placeholder={tr("空欄＝上の日本語と同じ", "Empty = same as above")} />
              </div>
              <div className="field">
                <label>{tr("価格の補足", "Price note")} <span className="muted">{tr("（英語・任意）", "(English, optional)")}</span></label>
                <input value={draft.en.price_note} onChange={(e) => setDraft({ ...draft, en: { ...draft.en, price_note: e.target.value } })} placeholder="Glass" />
              </div>
            </div>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={draft.is_available} onChange={(e) => setDraft({ ...draft, is_available: e.target.checked })} style={{ width: "auto" }} />
              {tr("お客様に表示", "Shown to guests")}
            </label>
            {err && <div className="alert err">{err}</div>}
            <div className="form-actions">
              <button className="btn btn-primary" onClick={saveItem} disabled={busy || !draft.name.trim()}>{busy ? tr("保存中…", "Saving…") : tr("品目を保存", "Save item")}</button>
              <button className="btn btn-ghost" onClick={() => setDraft(null)}>{tr("キャンセル", "Cancel")}</button>
            </div>
          </div>
        </div>
      )}

      {catDraft && (
        <div className="modal-backdrop" onClick={() => setCatDraft(null)}>
          <div className="card pad modal" onClick={(e) => e.stopPropagation()}>
            <div className="card-title">{tr("カテゴリを編集", "Edit category")}</div>
            <div className="field">
              <label>{tr("名前", "Name")}</label>
              <input value={catDraft.label} onChange={(e) => setCatDraft({ ...catDraft, label: e.target.value })} autoFocus />
            </div>
            <div className="field">
              <label>{tr("名前", "Name")} <span className="muted">{tr("（英語）", "(English)")}</span></label>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={catDraft.en_label} onChange={(e) => setCatDraft({ ...catDraft, en_label: e.target.value })} />
                <TranslateButton
                  enabled={canTranslate}
                  texts={{ label: catDraft.label }}
                  onResult={(t) => setCatDraft((d) => (d ? { ...d, en_label: t.label ?? d.en_label } : d))}
                />
              </div>
            </div>
            <div className="field" style={{ maxWidth: 120 }}>
              <label>{tr("表示順", "Order")}</label>
              <input inputMode="numeric" value={catDraft.sort_order} onChange={(e) => setCatDraft({ ...catDraft, sort_order: e.target.value.replace(/[^\d]/g, "") })} />
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" onClick={saveCategory} disabled={busy || !catDraft.label.trim()}>{busy ? tr("保存中…", "Saving…") : tr("カテゴリを保存", "Save category")}</button>
              <button className="btn btn-ghost" onClick={() => setCatDraft(null)}>{tr("キャンセル", "Cancel")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
