"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import { adminPost } from "@/lib/admin-fetch";
import { normalizeSeatLayout, seatCodes, seatLabel, type SeatLayout } from "@/lib/seat-label";
import { useTr } from "../../LangProvider";

declare global {
  interface Window {
    QRCode?: new (el: HTMLElement, opts: { text: string; width: number; height: number; correctLevel: number }) => unknown;
  }
}

export default function TableQr({
  liffId: initialLiff,
  storeSlug,
  storeName,
  layout: saved,
}: {
  liffId: string;
  storeSlug: string;
  storeName: string;
  layout: SeatLayout;
}) {
  const tr = useTr();
  const [liffId, setLiffId] = useState(initialLiff);
  const [counter, setCounter] = useState(String(saved.counter));
  const [tables, setTables] = useState(String(saved.tables));
  const [other, setOther] = useState(saved.other.join(", "));
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const layout = useMemo(
    () => normalizeSeatLayout({ counter: Number(counter) || 0, tables: Number(tables) || 0, other: other.split(/[,、]/) }),
    [counter, tables, other]
  );
  const seats = useMemo(() => seatCodes(layout), [layout]);
  const changed = JSON.stringify(layout) !== JSON.stringify(saved);

  const urlFor = (seat: string) =>
    `https://miniapp.line.me/${encodeURIComponent(liffId.trim())}?store=${encodeURIComponent(storeSlug)}&table=${encodeURIComponent(seat)}`;

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await adminPost("/api/admin/store/seats", { layout });
    setBusy(false);
    setMsg(res.ok ? { kind: "ok", text: tr("保存しました。", "Saved.") } : { kind: "err", text: res.error ?? tr("保存できませんでした", "Could not save") });
  }

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
      />

      <div className="card pad no-print" style={{ marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          <div className="field">
            <label htmlFor="counter">{tr("カウンター席の数", "Counter seats")}</label>
            <input id="counter" type="number" min={0} max={99} inputMode="numeric" value={counter} onChange={(e) => setCounter(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="tables">{tr("テーブルの数", "Tables")}</label>
            <input id="tables" type="number" min={0} max={99} inputMode="numeric" value={tables} onChange={(e) => setTables(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="other">{tr("その他の席（任意）", "Other seats (optional)")}</label>
            <input id="other" value={other} onChange={(e) => setOther(e.target.value)} placeholder={tr("テラス, 個室", "Terrace, Private room")} />
            <div className="hint">{tr("名前をカンマ区切りで入力します。", "Names, comma-separated.")}</div>
          </div>
        </div>
        <div className="field">
          <label htmlFor="liff">{tr("ミニアプリの LIFF ID", "Mini App LIFF ID")}</label>
          <input id="liff" value={liffId} onChange={(e) => setLiffId(e.target.value)} placeholder="1234567890-abcdEFGH" />
          <div className="hint">{tr("LINE Developers → ミニアプリのチャネルで確認できます。MINIAPP_LIFF_ID を設定すると自動で入力されます。", "From LINE Developers → Mini App channel. Set MINIAPP_LIFF_ID to prefill.")}</div>
        </div>
        {msg && <div className={`alert ${msg.kind}`}>{msg.text}</div>}
        <div className="form-actions" style={{ marginTop: 4 }}>
          <button className="btn btn-secondary" onClick={save} disabled={busy || !changed}>{busy ? tr("保存中…", "Saving…") : tr("席数を保存", "Save seats")}</button>
          <button className="btn btn-primary" onClick={() => window.print()} disabled={!liffId.trim() || seats.length === 0}>{tr(`印刷（${seats.length}枚）`, `Print (${seats.length})`)}</button>
          {seats[0] && liffId.trim() && <span className="muted mono" style={{ overflowWrap: "anywhere" }}>{urlFor(seats[0])}</span>}
        </div>
      </div>

      {!liffId.trim() ? (
        <div className="card"><div className="empty"><div className="t">{tr("ミニアプリの LIFF ID を入力してください", "Enter the Mini App LIFF ID")}</div></div></div>
      ) : seats.length === 0 ? (
        <div className="card"><div className="empty"><div className="t">{tr("カウンター席とテーブルの数を入力してください", "Enter the number of counter seats and tables")}</div></div></div>
      ) : (
        <div className="qr-grid">
          {seats.map((s) => (
            <div className="qr-tile" key={s}>
              <div className="qr-store">{storeName}</div>
              <div className="qr-table">{seatLabel(s, (ja) => ja)}</div>
              <div className="qr-table-en">{seatLabel(s, (_ja, en) => en)}</div>
              <Qr text={urlFor(s)} ready={ready} />
              <div className="qr-cta">LINEで読み取ってチェックイン / Scan with LINE to check in</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Qr({ text, ready }: { text: string; ready: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !ready || !window.QRCode) return;
    el.innerHTML = "";
    new window.QRCode(el, { text, width: 160, height: 160, correctLevel: 1 /* L */ });
  }, [text, ready]);
  return <div className="qr-img" ref={ref} style={{ minHeight: 160 }} />;
}
