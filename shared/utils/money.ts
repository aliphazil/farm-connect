import type { Locale } from "../constants/locales";

/**
 * Money is stored as an integer number of laari (1 MVR = 100 laari) so that
 * totals never suffer from floating-point rounding.
 */
export type Laari = number;

const CURRENCY_PREFIX: Record<Locale, string> = {
  en: "MVR",
  dv: "ރ.",
};

const amountFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 125000 → "MVR 1,250.00" (en) / "ރ. 1,250.00" (dv). */
export function formatMVR(laari: Laari, locale: Locale = "en"): string {
  if (!Number.isFinite(laari))
    throw new RangeError("Amount must be a finite number");
  const sign = laari < 0 ? "-" : "";
  return `${sign}${CURRENCY_PREFIX[locale]} ${amountFormatter.format(Math.abs(laari) / 100)}`;
}

/**
 * Parses a user-entered MVR amount ("1,250.5", "1250") into laari.
 * Returns null for anything that isn't a non-negative amount with at most 2 decimals.
 */
export function parseMVR(input: string): Laari | null {
  const cleaned = input.replace(/[,\s]/g, "").replace(/^(MVR|Rf\.?|ރ\.)/i, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function sumLaari(amounts: readonly Laari[]): Laari {
  return amounts.reduce((total, n) => total + n, 0);
}
