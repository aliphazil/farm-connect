import type { Metadata } from "next";
import { getDictionary, getLocale } from "@/i18n/server";
import { AppealCenter } from "@/features/appeals/components/appeal-center";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.appealPage.title, robots: { index: false } };
}

/** For suspended or blocked accounts: the reason, and appeals. */
export default async function AppealPage() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  return (
    <>
      <h1 className="text-2xl font-bold">{dict.appealPage.title}</h1>
      <p className="mt-1 mb-5 text-muted">{dict.appealPage.intro}</p>
      <AppealCenter dict={dict} locale={locale} />
    </>
  );
}
