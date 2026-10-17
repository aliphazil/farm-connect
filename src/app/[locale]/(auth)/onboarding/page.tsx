import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ROLE_HOME } from "@shared/constants/roles";
import type { Locale } from "@shared/constants/locales";
import type { Dictionary } from "@shared/i18n";
import { getDictionary, getLocale } from "@/i18n/server";
import { requireSignedIn } from "@/lib/auth/session";
import { RegisterForm } from "@/features/auth/components/register-form";
import { Spinner } from "@/components/ui/spinner";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.auth.onboardingTitle };
}

/** For signed-in users who don't have a profile/role yet. */
export default async function OnboardingPage() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  return (
    <>
      <h1 className="text-2xl font-bold">{dict.auth.onboardingTitle}</h1>
      <p className="mt-1 mb-5 text-muted">{dict.auth.onboardingIntro}</p>
      <Suspense fallback={<Spinner label={dict.common.loading} />}>
        <Onboarding locale={locale} dict={dict} />
      </Suspense>
    </>
  );
}

async function Onboarding({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const user = await requireSignedIn();
  if (user.role) redirect(`/${locale}${ROLE_HOME[user.role]}`);
  return <RegisterForm dict={dict} locale={locale} mode="onboarding" />;
}
