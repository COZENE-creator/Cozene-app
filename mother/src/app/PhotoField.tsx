"use client";

import { useRef, useState } from "react";
import { useTr } from "./LangProvider";

const MAX_SIDE = 1600;

/** Shrink a photo in the browser (phone photos are 3–12 MB) to a ≤1600px JPEG. */
async function shrink(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff"; // transparent PNGs → white, not black
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) throw new Error("encode");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Photo for a dish: take or choose a picture (on a phone this opens the camera
 * or the photo library) and it is uploaded; or paste a link to an image.
 */
export default function PhotoField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const tr = useTr();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [showUrl, setShowUrl] = useState(!!value && !value.startsWith("/media/"));

  async function upload(file: File) {
    setErr("");
    setBusy(true);
    try {
      let blob: Blob;
      try {
        blob = await shrink(file);
      } catch {
        throw new Error(tr("この画像は読み込めませんでした。JPEGかPNGの写真を選んでください。", "This image couldn't be read. Choose a JPEG or PNG photo."));
      }
      const res = await fetch("/api/admin/media", { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: blob });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      onChange(data.url);
      setShowUrl(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="photo-field">
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
        }}
      />
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="photo-preview" onError={() => setErr(tr("この写真を表示できません。URLを確認してください。", "This photo can't be shown. Check the URL."))} onLoad={() => setErr("")} />
      )}
      <div className="photo-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? tr("アップロード中…", "Uploading…") : value ? tr("写真を変更", "Change photo") : tr("写真を撮る・選ぶ", "Take or choose a photo")}
        </button>
        {value && !busy && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { onChange(""); setErr(""); }}>{tr("写真を外す", "Remove photo")}</button>
        )}
        {!showUrl && (
          <button type="button" className="btn-link" onClick={() => setShowUrl(true)}>{tr("URLで指定する", "Use a link instead")}</button>
        )}
      </div>
      {showUrl && (
        <input value={value} onChange={(e) => onChange(e.target.value.trim())} placeholder="https://…/photo.jpg" style={{ marginTop: 8 }} />
      )}
      {err && <div className="alert err" style={{ marginTop: 8 }}>{err}</div>}
    </div>
  );
}
