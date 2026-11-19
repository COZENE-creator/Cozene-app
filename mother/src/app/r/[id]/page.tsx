import type { Metadata } from "next";
import { verifyLink } from "@/lib/auth";
import { getReservationForStaff, getReservationSettings, timeSlots, formatReservationTime } from "@/lib/reservations";
import { RESERVATION_STATUS } from "@/lib/reservation-labels";
import { getTr, getLang } from "@/lib/lang-server";
import { LangSwitch } from "../../LangProvider";
import ReservationReplyForm from "../../ReservationReplyForm";
import ReservationHistory from "../../ReservationHistory";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "予約への返信 / Reply to reservation", robots: { index: false } };

/**
 * Reply page staff open from the LINE notification of a new request — works
 * on a phone without logging in to Mother. The signed link (?u=&t=) is the
 * permission; see staffReplyLink() in lib/reservations.ts.
 */
export default async function StaffReplyPage({ params, searchParams }: { params: { id: string }; searchParams: { u?: string; t?: string } }) {
  const tr = getTr();
  const lang = getLang();
  const u = searchParams.u ?? "";
  const t = searchParams.t ?? "";
  const valid = verifyLink(`resv:${params.id}:${u}`, t);
  const r = valid ? await getReservationForStaff(params.id) : null;

  if (!r) {
    return (
      <main className="staff-reply">
        <div className="card pad"><div className="empty"><div className="t">{tr("この予約は表示できません", "This reservation can't be shown")}</div>
          <div>{tr("リンクが正しくないか、予約が見つかりません。", "The link is invalid or the reservation no longer exists.")}</div></div></div>
      </main>
    );
  }

  const settings = await getReservationSettings(r.store_id);
  const st = RESERVATION_STATUS[r.status];
  const open = ["requested", "proposed", "confirmed"].includes(r.status) && new Date(r.reserved_for).getTime() > Date.now() - 86_400_000;
  const requestedDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date(r.reserved_for));

  return (
    <main className="staff-reply">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div className="muted">{r.store_name} · {tr("予約", "Reservation")}</div>
        <LangSwitch />
      </div>

      <div className="card pad">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>{formatReservationTime(r.reserved_for, lang)}</h1>
          <span className={`badge ${st?.badge ?? "neutral"}`}>{st ? tr(st.ja, st.en) : r.status}</span>
        </div>
        <div className="kv"><span className="k">{tr("人数", "Party")}</span><span>{tr(`${r.party_size}名`, String(r.party_size))}</span></div>
        <div className="kv"><span className="k">{tr("お名前", "Name")}</span><span>{r.name}{r.display_name && r.display_name !== r.name ? ` (LINE: ${r.display_name})` : ""}</span></div>
        {r.phone && <div className="kv"><span className="k">{tr("電話", "Phone")}</span><a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`}>{r.phone}</a></div>}
        {r.note && <div className="kv"><span className="k">{tr("ご要望", "Note")}</span><span style={{ whiteSpace: "pre-wrap", textAlign: "right" }}>{r.note}</span></div>}
        <div className="kv"><span className="k">{tr("ご案内の言語", "Guest's language")}</span><span>{r.lang === "en" ? tr("英語", "English") : tr("日本語", "Japanese")}</span></div>
        {r.proposed_for && r.status === "proposed" && (
          <div className="kv"><span className="k">{tr("提案中の日時", "Suggested time")}</span><span>{formatReservationTime(r.proposed_for, lang)}</span></div>
        )}
      </div>

      {open ? (
        <>
          <h2 style={{ fontSize: 16 }}>{tr("返信する", "Reply")}</h2>
          <div className="card pad">
            <ReservationReplyForm
              endpoint="/api/reservations/reply"
              payload={{ id: r.id, u, t }}
              status={r.status}
              times={timeSlots(settings)}
              defaultDate={requestedDay}
            />
          </div>
        </>
      ) : (
        <div className="alert ok" style={{ marginTop: 16 }}>{tr("この予約への返信は終了しています。", "This reservation is closed.")}</div>
      )}

      <h2 style={{ fontSize: 16 }}>{tr("履歴", "History")}</h2>
      <div className="card pad">
        <ReservationHistory events={r.events} tr={tr} lang={lang} />
      </div>
    </main>
  );
}
