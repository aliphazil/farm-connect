import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { LoginForm } from "@/features/auth/components/login-form";
import { RedirectIfSignedIn } from "@/features/auth/components/redirect-if-signed-in";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.auth.signInTitle };
}

export default async function LoginPage() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  return (
    <>
      <Suspense fallback={null}>
        <RedirectIfSignedIn locale={locale} />
      </Suspense>
      <h1 className="mb-5 text-2xl font-bold">{dict.auth.signInTitle}</h1>
      {/* The form reads ?next= (where to return after sign-in). */}
      <Suspense fallback={null}>
        <LoginForm dict={dict} locale={locale} />
      </Suspense>
      <p className="mt-6 text-sm text-muted">
        {dict.auth.noAccount}{" "}
        <Link
          href={localeHref(locale, "/register")}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {dict.nav.register}
        </Link>
      </p>
    </>
  );
}
