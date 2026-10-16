export const LOCALES = ["en", "dv"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_DIRECTION: Record<Locale, "ltr" | "rtl"> = {
  en: "ltr",
  dv: "rtl",
};

/** Names shown in the language switcher, each in its own language. */
export const LOCALE_LABEL: Record<Locale, string> = {
  en: "English",
  dv: "ދިވެހި",
};

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (LOCALES as readonly string[]).includes(value)
  );
}

/** Text stored in both languages. English is required; Dhivehi is optional. */
export type LocalizedText = { en: string; dv?: string };

export function pickLocalized(text: LocalizedText, locale: Locale): string {
  return (locale === "dv" && text.dv?.trim()) || text.en;
}
