import { describe, expect, it } from "vitest";
import {
  DEFAULT_SITE_CONFIG,
  contrastRatio,
  siteConfigSchema,
  type SiteConfig,
} from "./branding";

const withChange = (fn: (c: SiteConfig) => void) => {
  const c = structuredClone(DEFAULT_SITE_CONFIG);
  fn(c);
  return siteConfigSchema.safeParse(c);
};
const issues = (r: ReturnType<typeof withChange>) =>
  r.success ? [] : r.error.issues.map((i) => i.message);

describe("site config", () => {
  it("the defaults are valid", () => {
    expect(siteConfigSchema.safeParse(DEFAULT_SITE_CONFIG).success).toBe(true);
  });

  it("computes WCAG contrast", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#15803d", "#ffffff")).toBeGreaterThan(4.5);
  });

  it("rejects unreadable colour combinations and non-hex colours", () => {
    expect(
      issues(withChange((c) => void (c.theme.text = "#eeeeee"))),
    ).toContain("low_contrast_text");
    expect(
      issues(withChange((c) => void (c.theme.primary = "#ffeb3b"))),
    ).toContain("low_contrast_primary");
    expect(
      issues(
        withChange((c) => void (c.theme.accent = "red; background:url(x)")),
      ),
    ).toContain("invalid_color");
  });

  it("only allows approved styles and fonts", () => {
    expect(
      withChange(
        (c) => void ((c.theme as { font: string }).font = "Comic Sans"),
      ).success,
    ).toBe(false);
    expect(
      withChange(
        (c) => void ((c.theme as { buttonStyle: string }).buttonStyle = "blob"),
      ).success,
    ).toBe(false);
  });

  it("validates links: internal CTAs, https footer links, social hosts", () => {
    expect(
      issues(
        withChange(
          (c) => void (c.home.primaryCta.href = "https://evil.example"),
        ),
      ),
    ).toContain("invalid_internal_link");
    expect(
      withChange(
        (c) =>
          void c.footer.links.push({
            label: { en: "Ministry", dv: "" },
            href: "https://www.gov.mv",
          }),
      ).success,
    ).toBe(true);
    expect(
      issues(
        withChange(
          (c) =>
            void c.footer.links.push({
              label: { en: "x", dv: "" },
              href: "javascript:alert(1)",
            }),
        ),
      ),
    ).toContain("invalid_link");
    expect(
      withChange(
        (c) =>
          void c.footer.social.push({
            platform: "instagram",
            url: "https://www.instagram.com/farmconnect",
          }),
      ).success,
    ).toBe(true);
    expect(
      issues(
        withChange(
          (c) =>
            void c.footer.social.push({
              platform: "instagram",
              url: "https://instagram.evil.example/x",
            }),
        ),
      ),
    ).toContain("invalid_social_link");
    expect(
      issues(
        withChange(
          (c) => void (c.footer.about.en = "Hi [x](javascript:alert(1))"),
        ),
      ),
    ).toContain("unsafe_link");
  });

  it("requires every homepage section exactly once, and a valid default language", () => {
    expect(withChange((c) => void c.home.sections.pop()).success).toBe(false);
    expect(
      issues(
        withChange(
          (c) =>
            void (c.home.sections[1] = { id: "categories", visible: true }),
        ),
      ),
    ).toContain("duplicate_section");
    expect(
      issues(
        withChange(
          (c) => void (c.languages = { default: "dv", enabled: ["en"] }),
        ),
      ),
    ).toContain("default_not_enabled");
  });

  it("only accepts uploaded images from the branding folder", () => {
    expect(
      withChange(
        (c) => void (c.identity.logoPath = "branding/uploads/logo-1.png"),
      ).success,
    ).toBe(true);
    expect(
      issues(
        withChange((c) => void (c.identity.logoPath = "products/x/y.png")),
      ),
    ).toContain("invalid_image");
    expect(
      issues(
        withChange(
          (c) => void (c.identity.logoPath = "branding/uploads/../x.png"),
        ),
      ),
    ).toContain("invalid_image");
  });
});
