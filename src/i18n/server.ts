import { notFound } from "next/navigation";
import { locale as localeParam } from "next/root-params";
import { isLocale, type Locale } from "@shared/constants/locales";
import { dictionaries, type Dictionary } from "@shared/i18n";
import type { SiteConfig } from "@shared/schemas";
import { getPublishedConfig } from "@/services/server/branding";
import {
  getReferenceSettings,
  withReferenceLabels,
} from "@/services/server/reference";

/**
 * Locale of the current request, from the `[locale]` root segment.
 * Server Components only (root params aren't available in Server Actions).
 */
export async function getLocale(): Promise<Locale> {
  const value = await localeParam();
  if (!isLocale(value)) notFound();
  return value;
}

/**
 * The locale's dictionary, with admin-edited category and unit labels and the
 * published branding texts (site name, tagline, description, hero). Blank
 * branding texts keep the built-in translations.
 */
export async function getDictionary(): Promise<Dictionary> {
  const [locale, ref, config] = await Promise.all([
    getLocale(),
    getReferenceSettings(),
    getPublishedConfig(),
  ]);
  return withBrandingTexts(
    withReferenceLabels(dictionaries[locale], locale, ref),
    locale,
    config,
  );
}

/** The published Branding Studio settings (defaults until something is published). */
export const getSiteConfig = getPublishedConfig;

export function withBrandingTexts(
  dict: Dictionary,
  locale: Locale,
  c: SiteConfig,
): Dictionary {
  const pick = (t: { en: string; dv: string }) =>
    (locale === "dv" ? t.dv || t.en : t.en || t.dv).trim();
  const or = (value: string, fallback: string) => value || fallback;
  return {
    ...dict,
    meta: {
      ...dict.meta,
      siteName: or(pick(c.identity.siteName), dict.meta.siteName),
      tagline: or(pick(c.identity.tagline), dict.meta.tagline),
      description: or(pick(c.seo.description), dict.meta.description),
    },
    home: {
      ...dict.home,
      heroTitle: or(pick(c.home.heroTitle), dict.home.heroTitle),
      heroBody: or(pick(c.home.heroSubtitle), dict.home.heroBody),
      browseCta: or(pick(c.home.primaryCta.label), dict.home.browseCta),
    },
  };
}
