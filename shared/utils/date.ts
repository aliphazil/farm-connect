import type { Locale } from "../constants/locales";

const TIME_ZONE = "Indian/Maldives";

/** Runtime ICU data has no Dhivehi locale, so month names are provided here. */
const DV_MONTHS = [
  "ޖަނަވަރީ",
  "ފެބްރުއަރީ",
  "މާރިޗު",
  "އޭޕްރީލް",
  "މެއި",
  "ޖޫން",
  "ޖުލައި",
  "އޯގަސްޓު",
  "ސެޕްޓެމްބަރު",
  "އޮކްޓޯބަރު",
  "ނޮވެމްބަރު",
  "ޑިސެމްބަރު",
];

const partsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

const enFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** 3 Nov 2026 (en) / 3 ނޮވެމްބަރު 2026 (dv), in Maldives time. */
export function formatDate(date: Date, locale: Locale): string {
  if (locale === "en") return enFormatter.format(date);
  const parts = Object.fromEntries(
    partsFormatter.formatToParts(date).map((p) => [p.type, p.value]),
  );
  return `${Number(parts.day)} ${DV_MONTHS[Number(parts.month) - 1]} ${parts.year}`;
}

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** 3 Nov 2026, 14:05 — date and 24-hour time in Maldives time. */
export function formatDateTime(date: Date, locale: Locale): string {
  return `${formatDate(date, locale)}, ${timeFormatter.format(date)}`;
}

const isoDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** YYYY-MM-DD of `date` in Maldives time (for <input type="date">). */
export function maldivesDay(date: Date): string {
  return isoDayFormatter.format(date);
}

/** Maldives time is UTC+5 all year (no daylight saving). */
const MVT_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Start (00:00) or end (23:59:59.999) of a YYYY-MM-DD day in Maldives time. */
export function maldivesDayBoundary(
  day: string,
  edge: "start" | "end",
): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const utc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(utc) || maldivesDay(new Date(utc + 12 * 3600e3)) !== day)
    return null;
  const start = utc - MVT_OFFSET_MS;
  return new Date(edge === "start" ? start : start + 24 * 3600e3 - 1);
}
