import { maldivesDay, maldivesDayBoundary } from "@shared/utils/date";

/** Dashboard periods. All ranges are whole days in Maldives time. */
export const RANGE_PRESETS = [
  "today",
  "7d",
  "30d",
  "90d",
  "all",
  "custom",
] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

/** The analytics pages offer these (bounded ranges only). */
export const ANALYTICS_PRESETS = ["today", "7d", "30d", "custom"] as const;
/** The admin dashboard's choices. */
export const DASHBOARD_PRESETS = ["7d", "30d", "90d", "all", "custom"] as const;

export type ParsedRange = {
  preset: RangePreset;
  from: Date | null;
  to: Date;
  /** YYYY-MM-DD values for the form. */
  fromDay: string;
  toDay: string;
  /** A custom range longer than `maxDays` was shortened to its last days. */
  clamped?: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseRange(
  params: Record<string, string | string[] | undefined>,
  now: Date,
  {
    presets = DASHBOARD_PRESETS,
    maxDays,
  }: { presets?: readonly RangePreset[]; maxDays?: number } = {},
): ParsedRange {
  const one = (k: string) => {
    const v = params[k];
    return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
  };
  const requested = one("range") as RangePreset;
  const preset: RangePreset = presets.includes(requested) ? requested : "30d";
  const today = maldivesDay(now);
  const todayEnd = maldivesDayBoundary(today, "end")!;
  const lastDays = (days: number) =>
    maldivesDayBoundary(
      maldivesDay(new Date(todayEnd.getTime() - (days - 1) * DAY_MS)),
      "start",
    )!;

  if (preset === "custom") {
    let from = maldivesDayBoundary(one("from"), "start");
    let to = maldivesDayBoundary(one("to"), "end") ?? todayEnd;
    if (to > todayEnd) to = todayEnd;
    if (from && from <= to) {
      let clamped = false;
      if (maxDays) {
        const earliest = maldivesDayBoundary(
          maldivesDay(new Date(to.getTime() - (maxDays - 1) * DAY_MS)),
          "start",
        )!;
        if (from < earliest) {
          from = earliest;
          clamped = true;
        }
      }
      return {
        preset,
        from,
        to,
        fromDay: maldivesDay(from),
        toDay: maldivesDay(to),
        ...(clamped ? { clamped } : {}),
      };
    }
    // Invalid custom range: fall back to the default period.
    return parseRange({ range: "30d" }, now, { presets, maxDays });
  }
  if (preset === "all")
    return { preset, from: null, to: todayEnd, fromDay: "", toDay: today };

  const days = preset === "today" ? 1 : Number(preset.replace("d", ""));
  const from = lastDays(days);
  return {
    preset,
    from,
    to: todayEnd,
    fromDay: maldivesDay(from),
    toDay: today,
  };
}
