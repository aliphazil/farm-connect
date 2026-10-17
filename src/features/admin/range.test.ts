import { describe, expect, it } from "vitest";
import { parseRange } from "./range";

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
});
