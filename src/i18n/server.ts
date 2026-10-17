import { notFound } from "next/navigation";
import { locale as localeParam } from "next/root-params";
import { isLocale, type Locale } from "@shared/constants/locales";
import { dictionaries, type Dictionary } from "@shared/i18n";
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

/** The locale's dictionary, with admin-edited category and unit labels. */
export async function getDictionary(): Promise<Dictionary> {
  const [locale, ref] = await Promise.all([
    getLocale(),
    getReferenceSettings(),
  ]);
  return withReferenceLabels(dictionaries[locale], locale, ref);
}
