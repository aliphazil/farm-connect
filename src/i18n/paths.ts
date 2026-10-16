import { isLocale, type Locale } from "@shared/constants/locales";

export const LOCALE_COOKIE = "NEXT_LOCALE";

/** localeHref("dv", "/marketplace") → "/dv/marketplace" */
export function localeHref(locale: Locale, path = "/"): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return clean === "/" ? `/${locale}` : `/${locale}${clean}`;
}

/** Swaps the locale segment of a pathname: ("/en/marketplace", "dv") → "/dv/marketplace". */
export function switchLocalePath(pathname: string, target: Locale): string {
  const segments = pathname.split("/");
  if (isLocale(segments[1])) segments[1] = target;
  else segments.splice(1, 0, target);
  return segments.join("/") || `/${target}`;
}
