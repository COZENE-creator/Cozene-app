"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTr } from "../../LangProvider";

type Existing = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  responses: number;
} | null;

export default function SpecialForm({
  weekStart,
  existing,
}: {
  weekStart: string;
  existing: Existing;
}) {
  const router = useRouter();
  const tr = useTr();
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [imageUrl, setImageUrl] = useState(existing?.image_url ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function save() {
    if (!title.trim()) return setMsg({ kind: "err", text: tr("料理名を入力してください。", "Dish name is required.") });
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/specials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week_start: weekStart,
          title,
          description,
          image_url: imageUrl,
        }),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setMsg({ kind: "err", text: data?.error ?? tr(`保存できませんでした（HTTP ${res.status}）。`, `Could not save (HTTP ${res.status}).`) });
        return;
      }
      setMsg({ kind: "ok", text: existing ? tr("おすすめを更新しました。", "Special updated.") : tr("おすすめを公開しました。", "Special published.") });
      router.refresh();
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="two-col">
      <div>
        <div className="field">
          <label htmlFor="title">{tr("料理名", "Dish name")}</label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={tr("カツオのたたき 新玉ねぎ添え", "Seared bonito with new onion")}
          />
          <div className="hint">{tr(`${weekStart}の週（月〜日）`, `Week of ${weekStart} (Mon–Sun).`)}</div>
        </div>

        <div className="field">
          <label htmlFor="description">{tr("説明", "Description")}</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={tr("お客様の画面で写真の下に表示されます。", "Shown under the photo on the guest's screen.")}
            style={{ minHeight: 90 }}
          />
        </div>

        <div className="field">
          <label htmlFor="image">{tr("写真URL", "Photo URL")}</label>
          <input
            id="image"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://images.unsplash.com/photo-1553621042-f6e147245754?w=1200&q=80"
          />
          <div className="hint">
            {tr(
              "公開されているhttpsのURLを指定してください（LINE内のブラウザで読み込まれます）。横長の写真がおすすめです。お客様には4:3で表示されます。",
              "Must be a public https URL — it is loaded inside the LINE browser. Landscape crops best; the guest sees it at 4:3.",
            )}
          </div>
        </div>

        <div className="form-actions">
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? tr("保存中…", "Saving…") : existing ? tr("おすすめを更新", "Update special") : tr("おすすめを公開", "Publish special")}
          </button>
          {existing && existing.responses > 0 && (
            <span className="muted">{tr(`これまでの回答 ${existing.responses}件`, `${existing.responses} responses so far`)}</span>
          )}
        </div>

        {msg && <div className={`alert ${msg.kind === "ok" ? "ok" : "err"}`}>{msg.text}</div>}
      </div>

      {/* What the guest sees after paying — mirrors web/rate.html. */}
      <div>
        <div className="card-title">{tr("お客様の画面プレビュー", "Guest preview")}</div>
        <div className="phone">
          <div className="phone-bar">COZENE</div>
          <div className="phone-body">
            <div className="card" style={{ overflow: "hidden" }}>
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt=""
                  style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", display: "block" }}
                />
              ) : (
                <div
                  className="muted"
                  style={{
                    aspectRatio: "4 / 3",
                    display: "grid",
                    placeItems: "center",
                    background: "#e9edf1",
                    fontSize: 13,
                  }}
                >
                  {tr("写真", "Photo")}
                </div>
              )}
              <div style={{ padding: "12px 14px 14px" }}>
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--brand-ink)",
                  }}
                >
                  {tr("今週のおすすめ", "This week's special")}
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, marginTop: 5, lineHeight: 1.35 }}>
                  {title || <span className="muted">{tr("料理名", "Dish name")}</span>}
                </div>
                {description && (
                  <div className="muted" style={{ marginTop: 6, fontSize: 12.5, lineHeight: 1.55 }}>
                    {description}
                  </div>
                )}
              </div>
            </div>

            <div style={{ textAlign: "center", fontWeight: 700, fontSize: 13, margin: "16px 0 9px" }}>
              {tr("いかがでしたか？", "How was it?")}
            </div>
            <div className="rate-choices">
              <div className="rate-choice">
                <span className="emoji">😀</span>
                <span className="label">{tr("良い", "Good")}</span>
              </div>
              <div className="rate-choice">
                <span className="emoji">😐</span>
                <span className="label">{tr("普通", "OK")}</span>
              </div>
              <div className="rate-choice">
                <span className="emoji">😕</span>
                <span className="label">{tr("いまいち", "Not good")}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="hint" style={{ textAlign: "center" }}>
          {tr("お会計の直後に表示されます。", "Shown right after payment.")}
        </div>
      </div>
    </div>
  );
}
