import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { locale as localeParam } from "next/root-params";
import { cache } from "react";
import { isLocale, DEFAULT_LOCALE } from "@shared/constants/locales";
import { ROLE_HOME, ROLES, type Role } from "@shared/constants/roles";
import { getAdminAuth } from "@/lib/firebase/admin";

/**
 * `__session` is the only cookie Firebase Hosting / App Hosting forwards to
 * the server, so we use that name for the Firebase session cookie.
 */
export const SESSION_COOKIE_NAME = "__session";

export type SessionUser = {
  uid: string;
  role: Role;
  email?: string;
  name?: string;
};

/**
 * The single place that turns a request into a user (Data Access Layer).
 * Verifies the session cookie with revocation checks, so blocked (disabled)
 * accounts and revoked sessions are rejected. Deduplicated per request.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const cookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!cookie) return null;

  try {
    const token = await getAdminAuth().verifySessionCookie(cookie, true);
    if (token.blocked === true) return null;
    const role = (ROLES as readonly string[]).includes(token.role)
      ? (token.role as Role)
      : "buyer";
    return { uid: token.uid, role, email: token.email, name: token.name };
  } catch {
    // Expired, revoked, disabled account, or Firebase not configured.
    return null;
  }
});

async function currentLocale() {
  const value = await localeParam();
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * For Server Components: returns the user if they hold one of `roles`,
 * otherwise redirects (to sign-in, or to their own portal).
 * Must be called inside a <Suspense> boundary (it reads cookies).
 */
export async function requireRole(
  roles: readonly Role[],
): Promise<SessionUser> {
  const [user, locale] = await Promise.all([getSessionUser(), currentLocale()]);
  if (!user) redirect(`/${locale}/login`);
  if (!roles.includes(user.role)) redirect(`/${locale}${ROLE_HOME[user.role]}`);
  return user;
}

export class AuthorizationError extends Error {
  constructor(message = "Not authorised") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * For Server Actions and Route Handlers: re-verifies the session on every call
 * and throws instead of redirecting. Never trust the caller's UI state.
 */
export async function assertRole(roles: readonly Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || !roles.includes(user.role)) throw new AuthorizationError();
  return user;
}
