import { redirect } from "next/navigation";
import { ROLE_HOME } from "@shared/constants/roles";
import type { Locale } from "@shared/constants/locales";
import { getSessionUser } from "@/lib/auth/session";

/**
 * Renders nothing; sends already signed-in users to their portal (or to
 * onboarding if their profile isn't complete). Place inside <Suspense>.
 */
export async function RedirectIfSignedIn({ locale }: { locale: Locale }) {
  const user = await getSessionUser();
  if (user)
    redirect(`/${locale}${user.role ? ROLE_HOME[user.role] : "/onboarding"}`);
  return null;
}
