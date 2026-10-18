import {
  DEFAULT_LOCALE,
  LOCALES,
  isLocale,
  type Locale,
} from "@shared/constants/locales";
import { COLLECTIONS, SITE_SETTINGS_DOCS } from "@shared/firestore-paths";

/**
 * Default and enabled languages from the published branding, for the proxy.
 * Read with the Admin SDK and kept in memory for a minute, so routing doesn't
 * hit Firestore on every request. Falls back to all languages.
 */
export type LanguageSettings = { default: Locale; enabled: Locale[] };

const FALLBACK: LanguageSettings = {
  default: DEFAULT_LOCALE,
  enabled: [...LOCALES],
};
const TTL_MS = 60_000;
let cached: { at: number; value: LanguageSettings } | null = null;

export async function getLanguageSettings(): Promise<LanguageSettings> {
  if (process.env.CATALOG_SOURCE !== "firestore") return FALLBACK;
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  let value = FALLBACK;
  try {
    const { getAdminDb } = await import("@/lib/firebase/admin");
    const snap = await getAdminDb()
      .collection(COLLECTIONS.siteSettings)
      .doc(SITE_SETTINGS_DOCS.branding)
      .get();
    const langs = snap.get("config.languages") as
      { default?: unknown; enabled?: unknown } | undefined;
    const enabled = Array.isArray(langs?.enabled)
      ? langs.enabled.filter(isLocale)
      : [];
    if (
      enabled.length &&
      isLocale(langs?.default) &&
      enabled.includes(langs.default)
    )
      value = { default: langs.default, enabled };
  } catch (error) {
    console.error("Language settings unavailable; using all languages", error);
  }
  cached = { at: Date.now(), value };
  return value;
}
