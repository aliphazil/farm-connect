import { describe, expect, it } from "vitest";
import { DEFAULT_SITE_CONFIG } from "@shared/schemas";
import { themeVariables } from "./theme";

describe("themeVariables", () => {
  it("maps the theme to CSS variables from fixed values", () => {
    const v = themeVariables({
      ...DEFAULT_SITE_CONFIG.theme,
      buttonStyle: "pill",
      cardStyle: "soft",
      font: "serif",
    });
    expect(v["--btn-radius"]).toBe("9999px");
    expect(v["--font-body"]).toContain("Georgia");
    expect(v["--brand-primary"]).toBe("#15803d");
  });

  it("never passes through anything that isn't a hex colour or a listed value", () => {
    const v = themeVariables({
      ...DEFAULT_SITE_CONFIG.theme,
      primary: "red;}body{display:none",
      font: "x" as never,
      headingWeight: "900;" as never,
    });
    expect(v["--brand-primary"]).toBe("#15803d");
    expect(v["--font-body"]).toContain("var(--nf-inter)");
    expect(v["--heading-weight"]).toBe("700");
  });
});
