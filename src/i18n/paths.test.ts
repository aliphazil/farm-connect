import { describe, expect, it } from "vitest";
import { localeHref, switchLocalePath } from "./paths";

describe("localeHref", () => {
  it("prefixes paths with the locale", () => {
    expect(localeHref("en")).toBe("/en");
    expect(localeHref("dv", "/marketplace")).toBe("/dv/marketplace");
    expect(localeHref("en", "farmer")).toBe("/en/farmer");
  });
});

describe("switchLocalePath", () => {
  it("replaces an existing locale segment", () => {
    expect(switchLocalePath("/en/marketplace", "dv")).toBe("/dv/marketplace");
    expect(switchLocalePath("/dv", "en")).toBe("/en");
  });

  it("adds a locale when there is none", () => {
    expect(switchLocalePath("/marketplace", "dv")).toBe("/dv/marketplace");
  });
});
