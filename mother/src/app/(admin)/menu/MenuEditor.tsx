"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminPost } from "@/lib/admin-fetch";
import { money } from "@/lib/format";
import type { MenuCategory, MenuItem } from "@/lib/miniapp";

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
};

const emptyDraft = (categoryId: string, nextOrder: number): Draft => ({
  category_id: categoryId,
  name: "",
  description: "",
  price: "",
  price_note: "",
  image_url: "",
  sort_order: String(nextOrder),
  is_available: true,
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
});

export default function MenuEditor({ menu }: { menu: MenuCategory[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [newCat, setNewCat] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function run(body: Record<string, unknown>, after?: () => void) {
    setBusy(true);
    setErr("");
    const res = await adminPost("/api/admin/menu", body);
    setBusy(false);
    if (!res.ok) return setErr(res.error ?? "Could not save");
    after?.();
    router.refresh();
  }

  const saveItem = () =>
    draft && run({ action: "save_item", ...draft, price: draft.price.trim() }, () => setDraft(null));

  const toggle = (i: MenuItem) => run({ action: "save_item", ...toDraft(i), is_available: !i.is_available });

  const removeItem = (i: MenuItem) => confirm(`Delete "${i.name}"?`) && run({ action: "delete_item", id: i.id });

  const removeCategory = (c: MenuCategory) =>
    confirm(`Delete "${c.label}" and its ${c.items.length} items?`) && run({ action: "delete_category", id: c.id });

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
            <span className="muted" style={{ fontWeight: 400 }}>{c.items.length} items</span>
            <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setDraft(emptyDraft(c.id, c.items.length + 1))}>Add item</button>
              <button className="btn btn-ghost btn-sm" onClick={() => removeCategory(c)}>Delete category</button>
            </span>
          </h2>
          <div className="card table-card">
            <table>
              <thead><tr><th>Item</th><th className="num">Price</th><th>Shown</th><th></th></tr></thead>
              <tbody>
                {c.items.length === 0 && (
                  <tr><td colSpan={4}><div className="empty"><div>No items. Guests see &quot;Ask our staff&quot;.</div></div></td></tr>
                )}
                {c.items.map((i) => (
                  <tr key={i.id} style={i.is_available ? undefined : { opacity: 0.55 }}>
                    <td>
                      <div className="cell-strong">{i.name}</div>
                      {i.description && <div className="muted">{i.description}</div>}
                    </td>
                    <td className="num">
                      {i.price != null ? money(i.price) : "—"}
                      {i.price_note && <div className="muted">{i.price_note}</div>}
                    </td>
                    <td>
                      <button className={`badge plain ${i.is_available ? "ok" : "neutral"}`} style={{ border: 0, cursor: "pointer" }} onClick={() => toggle(i)} disabled={busy}>
                        {i.is_available ? "Shown" : "Hidden"}
                      </button>
                    </td>
                    <td className="num" style={{ whiteSpace: "nowrap" }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setDraft(toDraft(i))}>Edit</button>{" "}
                      <button className="btn btn-ghost btn-sm" onClick={() => removeItem(i)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <h2>New category</h2>
      <div className="card pad" style={{ display: "flex", gap: 10, maxWidth: 520 }}>
        <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="e.g. Bottles, Cheese, Non-alcoholic" />
        <button className="btn btn-primary" onClick={addCategory} disabled={busy || !newCat.trim()}>Add</button>
      </div>

      {draft && (
        <div className="modal-backdrop" onClick={() => setDraft(null)}>
          <div className="card pad modal" onClick={(e) => e.stopPropagation()}>
            <div className="card-title">{draft.id ? "Edit item" : "New item"}</div>
            <div className="field">
              <label>Category</label>
              <select value={draft.category_id} onChange={(e) => setDraft({ ...draft, category_id: e.target.value })}>
                {menu.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Name</label>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
            </div>
            <div className="field">
              <label>Description</label>
              <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} style={{ minHeight: 70 }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 90px", gap: 10 }}>
              <div className="field">
                <label>Price (¥)</label>
                <input inputMode="numeric" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value.replace(/[^\d]/g, "") })} placeholder="Blank = ask staff" />
              </div>
              <div className="field">
                <label>Price note</label>
                <input value={draft.price_note} onChange={(e) => setDraft({ ...draft, price_note: e.target.value })} placeholder="Glass 90ml" />
              </div>
              <div className="field">
                <label>Order</label>
                <input inputMode="numeric" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: e.target.value.replace(/[^\d]/g, "") })} />
              </div>
            </div>
            <div className="field">
              <label>Photo URL <span className="muted">(optional)</span></label>
              <input value={draft.image_url} onChange={(e) => setDraft({ ...draft, image_url: e.target.value })} placeholder="https://…" />
            </div>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={draft.is_available} onChange={(e) => setDraft({ ...draft, is_available: e.target.checked })} style={{ width: "auto" }} />
              Shown to guests
            </label>
            <div className="form-actions">
              <button className="btn btn-primary" onClick={saveItem} disabled={busy || !draft.name.trim()}>{busy ? "Saving…" : "Save item"}</button>
              <button className="btn btn-ghost" onClick={() => setDraft(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
