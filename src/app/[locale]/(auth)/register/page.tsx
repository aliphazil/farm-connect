import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { RedirectIfSignedIn } from "@/features/auth/components/redirect-if-signed-in";
import { RegisterForm } from "@/features/auth/components/register-form";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.auth.registerTitle };
}

export default async function RegisterPage() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  return (
    <>
      <Suspense fallback={null}>
        <RedirectIfSignedIn locale={locale} />
      </Suspense>
      <h1 className="text-2xl font-bold">{dict.auth.registerTitle}</h1>
      <p className="mt-1 mb-5 text-muted">{dict.auth.registerIntro}</p>
      <RegisterForm dict={dict} locale={locale} />
      <p className="mt-6 text-sm text-muted">
        {dict.auth.haveAccount}{" "}
        <Link
          href={localeHref(locale, "/login")}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {dict.nav.signIn}
        </Link>
      </p>
    </>
  );
}
