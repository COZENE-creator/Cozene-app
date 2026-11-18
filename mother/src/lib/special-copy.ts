import type { Lang } from "./lang";

/**
 * Pure helpers for the weekly special — no DB imports, so both server code and
 * client components can use them (the compose form generates copy in-browser).
 */

export type Rating = "good" | "ok" | "bad";
export const RATINGS: Rating[] = ["good", "ok", "bad"];

/** Guest-facing labels (ja/en). Kept here so the LIFF screen and admin agree. */
export const RATING_LABEL: Record<Rating, { ja: string; en: string }> = {
  good: { ja: "良い", en: "Good" },
  ok: { ja: "普通", en: "OK" },
  bad: { ja: "いまいち", en: "Not good" },
};

export function isRating(value: unknown): value is Rating {
  return typeof value === "string" && (RATINGS as string[]).includes(value);
}

/**
 * Monday of the week containing `date`, as YYYY-MM-DD.
 * A "week" runs Mon–Sun; the special is keyed on its Monday.
 */
export function weekStart(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = d.getUTCDay(); // 0=Sun
  d.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1));
  return d.toISOString().slice(0, 10);
}

export type ResultSummary = {
  title: string;
  good: number;
  ok: number;
  bad: number;
  responses: number;
  score: number | null;
};

/**
 * Suggested push copy built from a special's result — the "use the result as
 * notification content" step. Written per rating group, because the same result
 * warrants a different message to a guest who loved the dish than to one who
 * did not. Always editable before sending. Written in `lang` (the admin's
 * current interface language).
 */
export function buildMessage(special: ResultSummary, ratings: Rating[], lang: Lang): string {
  const only = ratings.length === 1 ? ratings[0] : null;
  const ja = lang === "ja";

  if (only === "good") {
    return (ja
      ? [
          `「${special.title}」に高い評価をいただき、ありがとうございます！`,
          "",
          `${special.responses}人中${special.good}人のお客様に「良い」と評価いただきました。`,
          "近々メニューに再登場予定です。どうぞお楽しみに。",
        ]
      : [
          `${special.title} — thank you for the great rating!`,
          "",
          `${special.good} of ${special.responses} guests rated it Good.`,
          "It's coming back to the menu, so please look forward to it.",
        ]
    ).join("\n");
  }
  if (only === "ok") {
    return (ja
      ? [
          `「${special.title}」をご評価いただき、ありがとうございます。`,
          "",
          "いただいたご意見をもとに、レシピをさらに磨いています。",
          "来週のおすすめもぜひ食べにいらしてください。",
        ]
      : [
          `Thank you for rating ${special.title}.`,
          "",
          "We're refining the recipe based on what you told us.",
          "Next week's special is worth a visit.",
        ]
    ).join("\n");
  }
  if (only === "bad") {
    return (ja
      ? [
          `「${special.title}」への率直なご意見、ありがとうございます。`,
          "",
          "いただいた声を真摯に受け止め、料理を見直しています。",
          "次回のおすすめはサービスさせていただきますので、ぜひお試しください。",
        ]
      : [
          `Thank you for your honest feedback on ${special.title}.`,
          "",
          "We're taking it to heart and reworking the dish.",
          "Please come and try the next one — it's on us.",
        ]
    ).join("\n");
  }

  if (ja) {
    return [
      `今週のおすすめ：${special.title}`,
      "",
      special.responses > 0
        ? `${special.responses}人中${special.good}人のお客様に「良い」と評価いただきました（${special.score}%）。`
        : "ただいま提供中です。ぜひ召し上がって、ご感想をお聞かせください。",
      "皆さまのご来店を心よりお待ちしております。",
    ].join("\n");
  }
  return [
    `This week's special: ${special.title}`,
    "",
    special.responses > 0
      ? `Rated Good by ${special.good} of ${special.responses} guests (${special.score}%).`
      : "Now serving — come and tell us what you think.",
    "We look forward to seeing you.",
  ].join("\n");
}
