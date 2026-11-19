/** Bilingual labels for reservation statuses and history steps (admin + staff reply page). */

export const RESERVATION_STATUS: Record<string, { ja: string; en: string; badge: string }> = {
  requested: { ja: "リクエスト", en: "Requested", badge: "warn" },
  proposed: { ja: "別の日時を提案中", en: "Other time suggested", badge: "pending" },
  confirmed: { ja: "確定", en: "Confirmed", badge: "ok" },
  declined: { ja: "お断り", en: "Declined", badge: "danger" },
  cancelled: { ja: "キャンセル", en: "Cancelled", badge: "neutral" },
};

export const RESERVATION_EVENT: Record<string, { ja: string; en: string }> = {
  requested: { ja: "予約リクエスト", en: "Requested" },
  confirmed: { ja: "確定", en: "Confirmed" },
  proposed: { ja: "別の日時を提案", en: "Suggested another time" },
  declined: { ja: "お断り", en: "Declined" },
  cancelled: { ja: "お客様がキャンセル", en: "Guest cancelled" },
  accepted: { ja: "お客様が提案の日時で予約", en: "Guest booked the suggested time" },
};
