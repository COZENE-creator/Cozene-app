"use client";

import { useState } from "react";
import { adminPost } from "@/lib/admin-fetch";
import { useTr } from "@/app/LangProvider";

export default function PinForm({ pinSet }: { pinSet: boolean }) {
  const tr = useTr();
  const [pin, setPin] = useState("");
  const [isSet, setIsSet] = useState(pinSet);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await adminPost("/api/admin/store/pin", { pin });
    setBusy(false);
    if (!res.ok) return setMsg({ kind: "err", text: res.error ?? tr("保存できませんでした", "Could not save") });
    setPin("");
    setIsSet(true);
    setMsg({ kind: "ok", text: tr("PINを保存しました。新しいPINをスタッフに伝えてください。", "PIN saved. Tell your staff the new PIN.") });
  }

  return (
    <div style={{ maxWidth: 420 }}>
      <p className="muted" style={{ marginBottom: 14 }}>
        {tr(
          "グラスワイン1杯サービスを確認するとき、スタッフがお客様のスマートフォンでこのPINを入力します。入力ミスはお客様1人につき15分間で5回までです。",
          "Staff type this PIN on the guest's phone to confirm the free glass. Wrong guesses are limited to 5 per guest per 15 minutes."
        )}{" "}
        <span className={`badge ${isSet ? "ok" : "warn"}`}>{isSet ? tr("設定済み", "Set") : tr("未設定 — 特典を利用できません", "Not set — benefits can't be redeemed")}</span>
      </p>
      <div className="field">
        <label htmlFor="pin">{isSet ? tr("新しいPIN", "New PIN") : "PIN"}</label>
        <input
          id="pin"
          inputMode="numeric"
          autoComplete="off"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
          placeholder={tr("4〜8桁の数字", "4–8 digits")}
        />
      </div>
      <button className="btn btn-primary" onClick={save} disabled={busy || pin.length < 4}>
        {busy ? tr("保存中…", "Saving…") : isSet ? tr("PINを変更", "Change PIN") : tr("PINを設定", "Set PIN")}
      </button>
      {msg && <div className={`alert ${msg.kind}`}>{msg.text}</div>}
    </div>
  );
}
