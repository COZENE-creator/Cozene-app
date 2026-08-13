/**
 * Pure helpers for the weekly special — no DB imports, so both server code and
 * client components can use them (the compose form generates copy in-browser).
 */

export type Rating = "good" | "ok" | "bad";
export const RATINGS: Rating[] = ["good", "ok", "bad"];

/** Guest-facing labels. Kept here so the LIFF screen and admin agree. */
export const RATING_LABEL: Record<Rating, string> = {
  good: "Good",
  ok: "OK",
  bad: "Not good",
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
 * did not. Always editable before sending.
 */
export function buildMessage(special: ResultSummary, ratings: Rating[]): string {
  const only = ratings.length === 1 ? ratings[0] : null;

  if (only === "good") {
    return [
      `${special.title} — thank you for the great rating!`,
      "",
      `${special.good} of ${special.responses} guests rated it Good.`,
      "It's coming back to the menu, so please look forward to it.",
    ].join("\n");
  }
  if (only === "ok") {
    return [
      `Thank you for rating ${special.title}.`,
      "",
      "We're refining the recipe based on what you told us.",
      "Next week's special is worth a visit.",
    ].join("\n");
  }
  if (only === "bad") {
    return [
      `Thank you for your honest feedback on ${special.title}.`,
      "",
      "We're taking it to heart and reworking the dish.",
      "Please come and try the next one — it's on us.",
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
