import { describe, expect, it } from "vitest";
import { safeNextPath } from "./use-auth-redirect";

describe("safeNextPath", () => {
  it("accepts in-site locale paths", () => {
    expect(safeNextPath("/en/products/abc")).toBe("/en/products/abc");
    expect(safeNextPath("/dv")).toBe("/dv");
  });

  it("rejects anything that could leave the site", () => {
    for (const bad of [
      "https://evil.example",
      "//evil.example",
      "/fr/x",
      "/en\\..\\x",
      "javascript:alert(1)",
      "",
      null,
    ]) {
      expect(safeNextPath(bad)).toBeNull();
    }
  });
});
