/** Format a minor-unit amount. JPY has no minor units, so amounts are whole yen. */
export function money(amount: number | null | undefined, currency = "JPY"): string {
  if (amount == null) return "—";
  const zeroDecimal = currency === "JPY" || currency === "KRW";
  const value = zeroDecimal ? amount : amount / 100;
  try {
    return new Intl.NumberFormat("ja-JP", { style: "currency", currency }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

export function datetime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short" });
}
