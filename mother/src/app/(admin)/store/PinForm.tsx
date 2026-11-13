"use client";

import { useState } from "react";
import { adminPost } from "@/lib/admin-fetch";

export default function PinForm({ pinSet }: { pinSet: boolean }) {
  const [pin, setPin] = useState("");
  const [isSet, setIsSet] = useState(pinSet);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await adminPost("/api/admin/store/pin", { pin });
    setBusy(false);
    if (!res.ok) return setMsg({ kind: "err", text: res.error ?? "Could not save" });
    setPin("");
    setIsSet(true);
    setMsg({ kind: "ok", text: "PIN saved. Tell your staff the new PIN." });
  }

  return (
    <div style={{ maxWidth: 420 }}>
      <p className="muted" style={{ marginBottom: 14 }}>
        Staff type this PIN on the guest&apos;s phone to confirm the free glass. Wrong guesses are
        limited to 5 per guest per 15 minutes.{" "}
        <span className={`badge ${isSet ? "ok" : "warn"}`}>{isSet ? "Set" : "Not set — benefits can't be redeemed"}</span>
      </p>
      <div className="field">
        <label htmlFor="pin">{isSet ? "New PIN" : "PIN"}</label>
        <input
          id="pin"
          inputMode="numeric"
          autoComplete="off"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
          placeholder="4–8 digits"
        />
      </div>
      <button className="btn btn-primary" onClick={save} disabled={busy || pin.length < 4}>
        {busy ? "Saving…" : isSet ? "Change PIN" : "Set PIN"}
      </button>
      {msg && <div className={`alert ${msg.kind}`}>{msg.text}</div>}
    </div>
  );
}
