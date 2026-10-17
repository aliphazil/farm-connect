import { describe, expect, it } from "vitest";
import { placeText } from "../constants/geography";
import { fill } from "../i18n/format";
import { formatDate } from "./date";

describe("fill", () => {
  it("replaces known placeholders and keeps unknown ones", () => {
    expect(
      fill("{count} products in {place}", { count: 3, place: "Thoddoo" }),
    ).toBe("3 products in Thoddoo");
    expect(fill("Hello {name}", {})).toBe("Hello {name}");
  });
});

describe("formatDate", () => {
  // 20:00 UTC on 2 Nov is already 3 Nov in the Maldives (UTC+5).
  const date = new Date("2026-11-02T20:00:00Z");

  it("formats in Maldives time", () => {
    expect(formatDate(date, "en")).toBe("3 Nov 2026");
  });

  it("uses Thaana month names for Dhivehi", () => {
    expect(formatDate(date, "dv")).toBe("3 ނޮވެމްބަރު 2026");
  });
});

describe("placeText", () => {
  it("prefixes the atoll abbreviation except in Malé City", () => {
    expect(
      placeText(
        { atollCode: "AA", islandEn: "Thoddoo", islandDv: "ތޮއްޑޫ" },
        "en",
      ),
    ).toBe("AA. Thoddoo");
    expect(
      placeText(
        { atollCode: "AA", islandEn: "Thoddoo", islandDv: "ތޮއްޑޫ" },
        "dv",
      ),
    ).toBe("އއ. ތޮއްޑޫ");
    expect(placeText({ atollCode: "MLE", islandEn: "Hulhumalé" }, "en")).toBe(
      "Hulhumalé",
    );
    expect(placeText({ atollCode: "K", islandEn: "Thulusdhoo" }, "dv")).toBe(
      "ކ. Thulusdhoo",
    );
  });
});
