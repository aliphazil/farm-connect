import { NextResponse, type NextRequest } from "next/server";
import { isLocale, type Locale } from "@shared/constants/locales";
import { LOCALE_COOKIE } from "@/i18n/paths";
import {
  getLanguageSettings,
  type LanguageSettings,
} from "@/lib/branding/languages";

/**
 * Locale routing only, following the published default and enabled languages
 * (Branding Studio). This is NOT an authorization layer — portal access is
 * enforced by server code (src/lib/auth/session.ts) and Security Rules.
 */
function preferredLocale(
  request: NextRequest,
  langs: LanguageSettings,
): Locale {
  const fromCookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie) && langs.enabled.includes(fromCookie))
    return fromCookie;

  const accept = request.headers.get("accept-language") ?? "";
  const wantsDhivehi = accept
    .split(",")
    .some((part) => part.trim().toLowerCase().startsWith("dv"));
  if (wantsDhivehi && langs.enabled.includes("dv")) return "dv";
  return langs.default;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const firstSegment = pathname.split("/")[1];
  const langs = await getLanguageSettings();
  const url = request.nextUrl.clone();

  if (isLocale(firstSegment)) {
    if (langs.enabled.includes(firstSegment)) return;
    // A language that has been switched off: same page in the default language.
    url.pathname = `/${langs.default}${pathname.slice(firstSegment.length + 1)}`;
    return NextResponse.redirect(url);
  }

  url.pathname = `/${preferredLocale(request, langs)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip API routes, Next internals and files with an extension (favicon, images…).
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
