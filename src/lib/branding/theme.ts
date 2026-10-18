import type { SiteConfig } from "@shared/schemas";

/**
 * CSS custom properties for a published (validated) config. Values come only
 * from hex colours and fixed lists, never from free text, so nothing an
 * administrator types can become arbitrary CSS.
 */
const FONTS = {
  inter:
    "var(--nf-inter), var(--nf-thaana), ui-sans-serif, system-ui, sans-serif",
  system:
    "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, var(--nf-thaana), sans-serif",
  serif: "ui-serif, Georgia, 'Times New Roman', var(--nf-thaana), serif",
} as const;

const BUTTON_RADIUS = {
  square: "0.25rem",
  rounded: "0.5rem",
  pill: "9999px",
} as const;
const CARD_RADIUS = {
  flat: "0.375rem",
  rounded: "0.75rem",
  soft: "1.25rem",
} as const;
const CARD_SHADOW = {
  flat: "none",
  rounded: "0 1px 2px rgb(0 0 0 / 0.05)",
  soft: "0 6px 20px rgb(0 0 0 / 0.07)",
} as const;

const HEX = /^#[0-9a-f]{6}$/;

export function themeVariables(
  theme: SiteConfig["theme"],
): Record<string, string> {
  const color = (v: string, fallback: string) => (HEX.test(v) ? v : fallback);
  return {
    "--brand-primary": color(theme.primary, "#15803d"),
    "--brand-secondary": color(theme.secondary, "#e9f2ec"),
    "--brand-accent": color(theme.accent, "#0e7490"),
    "--background": color(theme.background, "#fafaf7"),
    "--foreground": color(theme.text, "#1c1917"),
    "--font-body": FONTS[theme.font] ?? FONTS.inter,
    "--font-heading": FONTS[theme.headingFont] ?? FONTS.inter,
    "--heading-weight": ["600", "700", "800"].includes(theme.headingWeight)
      ? theme.headingWeight
      : "700",
    "--btn-radius": BUTTON_RADIUS[theme.buttonStyle] ?? BUTTON_RADIUS.rounded,
    "--card-radius": CARD_RADIUS[theme.cardStyle] ?? CARD_RADIUS.rounded,
    "--card-shadow": CARD_SHADOW[theme.cardStyle] ?? CARD_SHADOW.rounded,
  };
}
