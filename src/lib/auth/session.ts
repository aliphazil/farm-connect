import "server-only";

import { io } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { locale as localeParam } from "next/root-params";
import { cache } from "react";
import {
  adminCan,
  adminLevelOf,
  type AdminLevel,
  type AdminPermission,
} from "@shared/constants/admin";
import { DEFAULT_LOCALE, isLocale } from "@shared/constants/locales";
import { ROLE_HOME, isRole, type Role } from "@shared/constants/roles";
import { getAdminAuth } from "@/lib/firebase/admin";

/**
 * `__session` is the only cookie Firebase Hosting / App Hosting forwards to
 * the server, so we use that name for the Firebase session cookie.
 */
export const SESSION_COOKIE_NAME = "__session";
/** Session cookies last 5 days (Firebase allows 5 minutes – 2 weeks). */
export const SESSION_MAX_AGE_SECONDS = 5 * 24 * 60 * 60;

export type SessionUser = {
  uid: string;
  /** Null until the user has completed registration (no role claim yet). */
  role: Role | null;
  email?: string;
  name?: string;
  emailVerified: boolean;
  /** Admins only, from the `adminLevel` claim (least privilege if missing). */
  adminLevel?: AdminLevel;
};

/**
 * The single place that turns a request into a user (Data Access Layer).
 * Verifies the session cookie with revocation checks, so disabled (blocked)
 * accounts and revoked sessions are rejected. The role comes only from the
 * custom claim set by server code. Deduplicated per request.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const cookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!cookie) return null;
  // Verification reads the clock (token expiry). io() keeps that out of
  // prerenders/prefetches, where time-dependent values aren't allowed.
  await io();

  try {
    const token = await getAdminAuth().verifySessionCookie(cookie, true);
    if (token.blocked === true) return null;
    // Sessions are revoked on suspension; this is defence in depth.
    if (
      typeof token.suspendedUntil === "number" &&
      token.suspendedUntil > Date.now()
    )
      return null;
    const role = isRole(token.role) ? token.role : null;
    return {
      uid: token.uid,
      role,
      adminLevel: role === "admin" ? adminLevelOf(token.adminLevel) : undefined,
      email: token.email,
      name: typeof token.name === "string" ? token.name : undefined,
      emailVerified: token.email_verified === true,
    };
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
 * For Server Components: returns the signed-in user (any role, or none yet).
 * Redirects to sign-in when there is no valid session.
 */
export async function requireSignedIn(): Promise<SessionUser> {
  const [user, locale] = await Promise.all([getSessionUser(), currentLocale()]);
  if (!user) redirect(`/${locale}/login`);
  return user;
}

/**
 * For Server Components: returns the user if they hold one of `roles`,
 * otherwise redirects — to sign-in, to onboarding (no role yet), or to their
 * own portal. Must be called inside a <Suspense> boundary (it reads cookies).
 */
export async function requireRole(
  roles: readonly Role[],
): Promise<SessionUser & { role: Role }> {
  const [user, locale] = await Promise.all([getSessionUser(), currentLocale()]);
  if (!user) redirect(`/${locale}/login`);
  if (!user.role) redirect(`/${locale}/onboarding`);
  if (!roles.includes(user.role)) redirect(`/${locale}${ROLE_HOME[user.role]}`);
  return user as SessionUser & { role: Role };
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
export async function assertRole(
  roles: readonly Role[],
): Promise<SessionUser & { role: Role }> {
  const user = await getSessionUser();
  if (!user || !user.role || !roles.includes(user.role))
    throw new AuthorizationError();
  return user as SessionUser & { role: Role };
}

/**
 * For admin Server Actions: a verified admin session whose level grants
 * `permission` (shared/constants/admin.ts), or AuthorizationError.
 */
export async function assertAdminPermission(
  permission: AdminPermission,
): Promise<SessionUser & { role: "admin"; adminLevel: AdminLevel }> {
  const user = await assertRole(["admin"]);
  if (!adminCan(user.adminLevel, permission)) throw new AuthorizationError();
  return user as SessionUser & { role: "admin"; adminLevel: AdminLevel };
}
