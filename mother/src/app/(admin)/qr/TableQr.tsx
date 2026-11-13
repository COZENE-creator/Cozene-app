"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";

declare global {
  interface Window {
    QRCode?: new (el: HTMLElement, opts: { text: string; width: number; height: number; correctLevel: number }) => unknown;
  }
}

/** "1-12" or "1,2,5,A1" → table labels. */
function parseTables(spec: string): string[] {
  const out: string[] = [];
  for (const part of spec.split(",").map((s) => s.trim()).filter(Boolean)) {
    const m = /^(\d+)\s*-\s*(\d+)$/.exec(part);
    if (m) {
      const [a, b] = [Number(m[1]), Number(m[2])];
      for (let n = Math.min(a, b); n <= Math.max(a, b) && out.length < 200; n++) out.push(String(n));
    } else {
      out.push(part.slice(0, 16));
    }
  }
  return Array.from(new Set(out));
}

export default function TableQr({ liffId: initialLiff, storeSlug, storeName }: { liffId: string; storeSlug: string; storeName: string }) {
  const [liffId, setLiffId] = useState(initialLiff);
  const [spec, setSpec] = useState("1-10");
  const [ready, setReady] = useState(false);
  const tables = useMemo(() => parseTables(spec), [spec]);

  const urlFor = (table: string) =>
    `https://miniapp.line.me/${encodeURIComponent(liffId.trim())}?store=${encodeURIComponent(storeSlug)}&table=${encodeURIComponent(table)}`;

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
      />

      <div className="card pad no-print" style={{ marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="field">
            <label htmlFor="liff">Mini App LIFF ID</label>
            <input id="liff" value={liffId} onChange={(e) => setLiffId(e.target.value)} placeholder="1234567890-abcdEFGH" />
            <div className="hint">From LINE Developers → Mini App channel. Set MINIAPP_LIFF_ID to prefill.</div>
          </div>
          <div className="field">
            <label htmlFor="tables">Tables</label>
            <input id="tables" value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="1-12, Counter, Terrace" />
            <div className="hint">Ranges and names, comma-separated.</div>
          </div>
        </div>
        <div className="form-actions" style={{ marginTop: 4 }}>
          <button className="btn btn-primary" onClick={() => window.print()} disabled={!liffId.trim() || tables.length === 0}>Print</button>
          {tables[0] && liffId.trim() && <span className="muted mono" style={{ overflowWrap: "anywhere" }}>{urlFor(tables[0])}</span>}
        </div>
      </div>

      {!liffId.trim() ? (
        <div className="card"><div className="empty"><div className="t">Enter the Mini App LIFF ID</div></div></div>
      ) : (
        <div className="qr-grid">
          {tables.map((t) => (
            <div className="qr-tile" key={t}>
              <div className="qr-store">{storeName}</div>
              <div className="qr-table">Table {t}</div>
              <Qr text={urlFor(t)} ready={ready} />
              <div className="qr-cta">Scan with LINE to check in</div>
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
