import { maldivesDay, maldivesDayBoundary } from "@shared/utils/date";

/** Dashboard periods. Custom ranges use whole days in Maldives time. */
export const RANGE_PRESETS = ["7d", "30d", "90d", "all", "custom"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export type ParsedRange = {
  preset: RangePreset;
  from: Date | null;
  to: Date;
  /** YYYY-MM-DD values for the form. */
  fromDay: string;
  toDay: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseRange(
  params: Record<string, string | string[] | undefined>,
  now: Date,
): ParsedRange {
  const one = (k: string) => {
    const v = params[k];
    return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
  };
  const requested = one("range") as RangePreset;
  const preset: RangePreset = (RANGE_PRESETS as readonly string[]).includes(
    requested,
  )
    ? requested
    : "30d";
  const todayEnd = maldivesDayBoundary(maldivesDay(now), "end")!;

  if (preset === "custom") {
    const from = maldivesDayBoundary(one("from"), "start");
    let to = maldivesDayBoundary(one("to"), "end") ?? todayEnd;
    if (to > todayEnd) to = todayEnd;
    if (from && from <= to)
      return {
        preset,
        from,
        to,
        fromDay: maldivesDay(from),
        toDay: maldivesDay(to),
      };
    // Invalid custom range: fall back to the default period.
    return parseRange({ range: "30d" }, now);
  }
  if (preset === "all")
    return {
      preset,
      from: null,
      to: todayEnd,
      fromDay: "",
      toDay: maldivesDay(now),
    };

  const days = Number(preset.replace("d", ""));
  const from = maldivesDayBoundary(
    maldivesDay(new Date(todayEnd.getTime() - (days - 1) * DAY_MS)),
    "start",
  )!;
  return {
    preset,
    from,
    to: todayEnd,
    fromDay: maldivesDay(from),
    toDay: maldivesDay(now),
  };
}
