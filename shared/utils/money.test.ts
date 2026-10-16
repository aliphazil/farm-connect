import { describe, expect, it } from "vitest";
import { formatMVR, parseMVR, sumLaari } from "./money";

describe("formatMVR", () => {
  it("formats laari as MVR in English", () => {
    expect(formatMVR(125000)).toBe("MVR 1,250.00");
    expect(formatMVR(5)).toBe("MVR 0.05");
    expect(formatMVR(0)).toBe("MVR 0.00");
  });

  it("uses the Thaana currency prefix in Dhivehi", () => {
    expect(formatMVR(2550, "dv")).toBe("ރ. 25.50");
  });

  it("handles negatives and rejects non-finite values", () => {
    expect(formatMVR(-1050)).toBe("-MVR 10.50");
    expect(() => formatMVR(Number.NaN)).toThrow(RangeError);
  });
});

describe("parseMVR", () => {
  it.each([
    ["25", 2500],
    ["25.5", 2550],
    ["25.05", 2505],
    ["1,250.00", 125000],
    ["MVR 10", 1000],
    [" 0.99 ", 99],
  ])("parses %j → %i laari", (input, expected) => {
    expect(parseMVR(input)).toBe(expected);
  });

  it.each(["", "abc", "-5", "1.234", "1.2.3", "1e3"])("rejects %j", (input) => {
    expect(parseMVR(input)).toBeNull();
  });
});

describe("sumLaari", () => {
  it("adds integers exactly", () => {
    expect(sumLaari([10, 20, 30])).toBe(60);
    expect(sumLaari([])).toBe(0);
  });
});
