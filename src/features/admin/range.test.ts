import { describe, expect, it } from "vitest";
import { ANALYTICS_PRESETS, parseRange } from "./range";

// 2026-10-18 10:00 in Maldives (05:00 UTC)
const NOW = new Date("2026-10-18T05:00:00Z");

describe("parseRange", () => {
  it("defaults to the last 30 days, in whole Maldives days", () => {
    const r = parseRange({}, NOW);
    expect(r.preset).toBe("30d");
    expect(r.from?.toISOString()).toBe("2026-09-18T19:00:00.000Z"); // 19 Sep 00:00 MVT
    expect(r.to.toISOString()).toBe("2026-10-18T18:59:59.999Z"); // 18 Oct 23:59:59 MVT
    expect(r.fromDay).toBe("2026-09-19");
  });

  it("supports 7 days and all time", () => {
    expect(parseRange({ range: "7d" }, NOW).fromDay).toBe("2026-10-12");
    const all = parseRange({ range: "all" }, NOW);
    expect(all.from).toBeNull();
  });

  it("accepts a valid custom range and caps it at today", () => {
    const r = parseRange(
      { range: "custom", from: "2026-10-01", to: "2027-01-01" },
      NOW,
    );
    expect(r.from?.toISOString()).toBe("2026-09-30T19:00:00.000Z");
    expect(r.toDay).toBe("2026-10-18");
  });

  it("falls back when a custom range is invalid", () => {
    expect(
      parseRange({ range: "custom", from: "2026-10-10", to: "2026-10-01" }, NOW)
        .preset,
    ).toBe("30d");
    expect(
      parseRange({ range: "custom", from: "2026-02-30" }, NOW).preset,
    ).toBe("30d");
    expect(parseRange({ range: "bogus" }, NOW).preset).toBe("30d");
  });

  it("today is the current Maldives day, even late in the UTC day", () => {
    const opts = { presets: ANALYTICS_PRESETS };
    const r = parseRange({ range: "today" }, NOW, opts);
    expect(r.from?.toISOString()).toBe("2026-10-17T19:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-10-18T18:59:59.999Z");
    // 18 Oct 19:30 UTC is already 19 Oct 00:30 in Malé.
    const late = parseRange(
      { range: "today" },
      new Date("2026-10-18T19:30:00Z"),
      opts,
    );
    expect(late.fromDay).toBe("2026-10-19");
    // 18:59 UTC is still 18 Oct (23:59 MVT).
    expect(
      parseRange({ range: "today" }, new Date("2026-10-18T18:59:00Z"), opts)
        .fromDay,
    ).toBe("2026-10-18");
  });

  it("analytics pages only offer bounded presets and cap long custom ranges", () => {
    const opts = { presets: ANALYTICS_PRESETS, maxDays: 366 };
    expect(parseRange({ range: "all" }, NOW, opts).preset).toBe("30d");
    expect(parseRange({ range: "90d" }, NOW, opts).preset).toBe("30d");
    const long = parseRange(
      { range: "custom", from: "2020-01-01", to: "2026-10-18" },
      NOW,
      opts,
    );
    expect(long.clamped).toBe(true);
    expect(long.fromDay).toBe("2025-10-18");
    const ok = parseRange(
      { range: "custom", from: "2026-10-01", to: "2026-10-07" },
      NOW,
      opts,
    );
    expect(ok.clamped).toBeUndefined();
    expect([ok.fromDay, ok.toDay]).toEqual(["2026-10-01", "2026-10-07"]);
  });
});
