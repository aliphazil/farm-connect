"use client";

import { useRouter } from "next/navigation";
import type { Locale } from "@shared/constants/locales";
import { ROLE_HOME, type Role } from "@shared/constants/roles";

/**
 * A safe in-site return path ("/en/products/abc"), or null. Rejects anything
 * that could leave the site: absolute URLs, protocol-relative "//", backslashes.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || next.length > 300) return null;
  if (
    !/^\/(en|dv)(\/|$)/.test(next) ||
    next.startsWith("//") ||
    next.includes("\\")
  )
    return null;
  return next;
}

/** Sends the user to the right place after signing in or registering. */
export function useAuthRedirect(locale: Locale) {
  const router = useRouter();
  /**
   * `welcome`: just registered — farmers go on to finish their farm profile.
   * `next`: where the user was going before signing in (validated).
   */
  return (
    result: { role: Role | null },
    welcome = false,
    next?: string | null,
  ) => {
    const back = safeNextPath(next);
    const target = !result.role
      ? `/${locale}/onboarding`
      : welcome && result.role === "farmer"
        ? `/${locale}/farmer/profile?welcome=1`
        : (back ?? `/${locale}${ROLE_HOME[result.role]}`);
    router.replace(target);
    router.refresh();
  };
}
