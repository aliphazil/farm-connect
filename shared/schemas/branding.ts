import { z } from "zod";
import { DEFAULT_BRANDING } from "../constants/branding";
import { PRODUCT_CATEGORIES } from "../constants/catalog";
import { LOCALES } from "../constants/locales";
import { isInternalPath, safeExternalUrl, unsafeLinks } from "../rich-text";
import { idSchema } from "./common";

/**
 * Site branding and homepage settings, edited in the admin Branding Studio.
 * Everything here is data with a fixed shape: colours are hex values, styles
 * come from approved lists, links are https or internal paths, and text is
 * plain or the limited rich text in shared/rich-text.ts. There is no field
 * for HTML, CSS or scripts.
 *
 * Published: `siteSettings/branding` (public). Draft: `brandingDrafts/current`
 * and history: `brandingVersions/{id}` (admins only).
 */

const hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "invalid_color")
  .transform((v) => v.toLowerCase());

const text = (max: number) =>
  z.object({
    en: z.string().trim().max(max),
    dv: z.string().trim().max(max).default(""),
  });

const requiredText = (max: number) =>
  text(max).refine((t) => t.en.length > 0 || t.dv.length > 0, {
    message: "required",
    path: ["en"],
  });

const richText = (max: number) =>
  text(max).refine(
    (t) => !unsafeLinks(t.en).length && !unsafeLinks(t.dv).length,
    {
      message: "unsafe_link",
    },
  );

const internalPath = z
  .string()
  .trim()
  .max(200)
  .refine(isInternalPath, "invalid_internal_link");

const linkHref = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => isInternalPath(v) || safeExternalUrl(v) !== null,
    "invalid_link",
  );

/** Uploaded images live under branding/uploads/ in Storage (checked again on save). */
export const BRANDING_UPLOAD_PREFIX = "branding/uploads/";
const imagePath = z
  .string()
  .max(300)
  .regex(/^branding\/uploads\/[A-Za-z0-9._-]{1,120}$/, "invalid_image")
  .optional();

export const BRANDING_IMAGE_LIMITS = {
  bytes: 2 * 1024 * 1024,
  types: ["image/jpeg", "image/png", "image/webp"],
  faviconTypes: ["image/png", "image/x-icon", "image/vnd.microsoft.icon"],
  faviconBytes: 256 * 1024,
} as const;

export const FONT_CHOICES = ["inter", "system", "serif"] as const;
export const HEADING_WEIGHTS = ["600", "700", "800"] as const;
export const BUTTON_STYLES = ["square", "rounded", "pill"] as const;
export const CARD_STYLES = ["flat", "rounded", "soft"] as const;

export const HOME_SECTIONS = [
  "categories",
  "featured",
  "recent",
  "farms",
  "islands",
  "how",
  "promos",
  "register",
] as const;
export type HomeSectionId = (typeof HOME_SECTIONS)[number];

export const SOCIAL_PLATFORMS = {
  facebook: ["facebook.com", "www.facebook.com", "m.facebook.com"],
  instagram: ["instagram.com", "www.instagram.com"],
  tiktok: ["tiktok.com", "www.tiktok.com"],
  x: ["x.com", "twitter.com", "www.x.com"],
  youtube: ["youtube.com", "www.youtube.com", "youtu.be"],
  whatsapp: ["wa.me", "api.whatsapp.com", "chat.whatsapp.com"],
  viber: ["invite.viber.com", "chats.viber.com"],
} as const;
export type SocialPlatform = keyof typeof SOCIAL_PLATFORMS;

/** Blank labels/titles fall back to the built-in translations. */
const cta = z.object({ label: text(40), href: internalPath });

export const siteConfigSchema = z
  .object({
    identity: z.object({
      siteName: requiredText(60),
      tagline: text(160),
      logoPath: imagePath,
      faviconPath: imagePath,
    }),
    theme: z.object({
      primary: hex,
      secondary: hex,
      accent: hex,
      background: hex,
      text: hex,
      font: z.enum(FONT_CHOICES),
      headingFont: z.enum(FONT_CHOICES),
      headingWeight: z.enum(HEADING_WEIGHTS),
      buttonStyle: z.enum(BUTTON_STYLES),
      cardStyle: z.enum(CARD_STYLES),
    }),
    home: z.object({
      heroTitle: text(120),
      heroSubtitle: text(300),
      heroImagePath: imagePath,
      primaryCta: cta,
      secondaryCta: cta.optional(),
      sections: z
        .array(z.object({ id: z.enum(HOME_SECTIONS), visible: z.boolean() }))
        .length(HOME_SECTIONS.length)
        .refine(
          (s) => new Set(s.map((x) => x.id)).size === HOME_SECTIONS.length,
          "duplicate_section",
        ),
      featuredCategories: z
        .array(z.enum(PRODUCT_CATEGORIES))
        .max(PRODUCT_CATEGORIES.length),
      promos: z
        .array(
          z.object({
            title: requiredText(80),
            body: richText(500),
            imagePath,
            link: z
              .object({ label: requiredText(40), href: linkHref })
              .optional(),
          }),
        )
        .max(3),
    }),
    footer: z.object({
      about: richText(600),
      links: z
        .array(z.object({ label: requiredText(40), href: linkHref }))
        .max(8),
      contactEmail: z.union([z.literal(""), z.email().max(120)]),
      contactPhone: z.union([
        z.literal(""),
        z.string().regex(/^\+960[0-9]{7}$/, "invalid_phone"),
      ]),
      address: text(200),
      social: z
        .array(
          z
            .object({
              platform: z.enum(
                Object.keys(SOCIAL_PLATFORMS) as [
                  SocialPlatform,
                  ...SocialPlatform[],
                ],
              ),
              url: z.string().trim().max(300),
            })
            .refine((s) => {
              const safe = safeExternalUrl(s.url);
              if (!safe) return false;
              const host = new URL(safe).hostname.toLowerCase();
              return (
                SOCIAL_PLATFORMS[s.platform] as readonly string[]
              ).includes(host);
            }, "invalid_social_link"),
        )
        .max(7),
    }),
    languages: z
      .object({
        default: z.enum(LOCALES),
        enabled: z.array(z.enum(LOCALES)).min(1),
      })
      .refine((l) => l.enabled.includes(l.default), "default_not_enabled"),
    seo: z.object({
      title: text(70),
      description: text(200),
      shareImagePath: imagePath,
    }),
  })
  .superRefine((c, ctx) => {
    // Readable text on the page and on primary-coloured buttons/banners.
    if (contrastRatio(c.theme.text, c.theme.background) < 4.5)
      ctx.addIssue({
        code: "custom",
        path: ["theme", "text"],
        message: "low_contrast_text",
      });
    if (contrastRatio("#ffffff", c.theme.primary) < 4.5)
      ctx.addIssue({
        code: "custom",
        path: ["theme", "primary"],
        message: "low_contrast_primary",
      });
  });

export type SiteConfig = z.infer<typeof siteConfigSchema>;
export type SiteConfigInput = z.input<typeof siteConfigSchema>;

/** WCAG relative-luminance contrast ratio between two hex colours. */
export function contrastRatio(a: string, b: string): number {
  const lum = (h: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(h.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** The built-in look, used until an administrator publishes branding. */
export const DEFAULT_SITE_CONFIG: SiteConfig = {
  identity: {
    siteName: {
      en: DEFAULT_BRANDING.siteName.en,
      dv: DEFAULT_BRANDING.siteName.dv,
    },
    tagline: {
      en: DEFAULT_BRANDING.tagline.en,
      dv: DEFAULT_BRANDING.tagline.dv,
    },
  },
  theme: {
    primary: DEFAULT_BRANDING.primaryColor,
    secondary: "#e9f2ec",
    accent: DEFAULT_BRANDING.accentColor,
    background: "#fafaf7",
    text: "#1c1917",
    font: "inter",
    headingFont: "inter",
    headingWeight: "700",
    buttonStyle: "rounded",
    cardStyle: "rounded",
  },
  home: {
    heroTitle: { en: "", dv: "" },
    heroSubtitle: { en: "", dv: "" },
    primaryCta: { label: { en: "", dv: "" }, href: "/products" },
    sections: HOME_SECTIONS.map((id) => ({ id, visible: id !== "promos" })),
    featuredCategories: [],
    promos: [],
  },
  footer: {
    about: { en: "", dv: "" },
    links: [],
    contactEmail: "",
    contactPhone: "",
    address: { en: "", dv: "" },
    social: [],
  },
  languages: { default: "en", enabled: ["en", "dv"] },
  seo: { title: { en: "", dv: "" }, description: { en: "", dv: "" } },
};

/** `brandingVersions/{id}` — a published version, kept for restore. */
export const brandingVersionSchema = z.object({
  id: idSchema,
  number: z.number().int().positive(),
  config: siteConfigSchema,
  note: z.string().max(200).optional(),
  publishedBy: idSchema,
  publishedAt: z.date(),
});
export type BrandingVersion = z.infer<typeof brandingVersionSchema>;
