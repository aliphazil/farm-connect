import { describe, expect, it } from "vitest";
import { normalizeText, queryTokens, searchTokens, words } from "./search";

describe("search tokens", () => {
  it("normalises case and Latin accents", () => {
    expect(normalizeText("Hulhumalé PAPAYA")).toBe("hulhumale papaya");
    expect(words("Green chillies, 1kg!")).toEqual(["green", "chillies", "1kg"]);
  });

  it("stores word prefixes for English and Dhivehi names", () => {
    const tokens = searchTokens("Ripe papaya", "ފަޅޯ");
    expect(tokens).toEqual(
      expect.arrayContaining([
        "ri",
        "rip",
        "ripe",
        "pa",
        "papa",
        "papaya",
        "ފަ",
        "ފަޅ",
        "ފަޅޯ",
      ]),
    );
    expect(tokens).not.toContain("p");
  });

  it("caps token length and count", () => {
    const tokens = searchTokens("a".repeat(40));
    expect(Math.max(...tokens.map((t) => t.length))).toBe(15);
    expect(
      searchTokens(Array.from({ length: 200 }, (_, i) => `word${i}`).join(" "))
        .length,
    ).toBeLessThanOrEqual(80);
  });

  it("queries by the longest word and checks the rest in memory", () => {
    expect(queryTokens("ripe PAPAYA")).toEqual({
      primary: "papaya",
      rest: ["ripe"],
    });
    expect(queryTokens("ފަޅޯ")).toEqual({ primary: "ފަޅޯ", rest: [] });
    expect(queryTokens("a")).toEqual({ primary: null, rest: [] });
  });

  it("a query token always matches a stored prefix of the same word", () => {
    const stored = searchTokens("Butterhead lettuce");
    for (const q of ["butter", "lett", "lettuce", "buTTerhead"]) {
      expect(stored).toContain(queryTokens(q).primary);
    }
  });
});
