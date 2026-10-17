import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.auth.resetTitle };
}

export default async function ForgotPasswordPage() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  return (
    <>
      <h1 className="text-2xl font-bold">{dict.auth.resetTitle}</h1>
      <p className="mt-1 mb-5 text-muted">{dict.auth.resetIntro}</p>
      <ResetPasswordForm dict={dict} locale={locale} />
      <p className="mt-6 text-sm">
        <Link
          href={localeHref(locale, "/login")}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {dict.auth.backToSignIn}
        </Link>
      </p>
    </>
  );
}
