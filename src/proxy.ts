import { NextResponse, type NextRequest } from "next/server";
import {
  DEFAULT_LOCALE,
  isLocale,
  type Locale,
} from "@shared/constants/locales";
import { LOCALE_COOKIE } from "@/i18n/paths";

/**
 * Locale routing only. This is NOT an authorization layer — portal access is
 * enforced by server code (src/lib/auth/session.ts) and Security Rules.
 */
function preferredLocale(request: NextRequest): Locale {
  const fromCookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;

  const accept = request.headers.get("accept-language") ?? "";
  const wantsDhivehi = accept
    .split(",")
    .some((part) => part.trim().toLowerCase().startsWith("dv"));
  return wantsDhivehi ? "dv" : DEFAULT_LOCALE;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const firstSegment = pathname.split("/")[1];
  if (isLocale(firstSegment)) return;

  const url = request.nextUrl.clone();
  url.pathname = `/${preferredLocale(request)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip API routes, Next internals and files with an extension (favicon, images…).
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
