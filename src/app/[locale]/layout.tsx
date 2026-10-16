import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Thaana } from "next/font/google";
import { LOCALE_DIRECTION, LOCALES } from "@shared/constants/locales";
import { getDictionary, getLocale } from "@/i18n/server";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import "../globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--nf-inter",
  display: "swap",
});
const thaana = Noto_Sans_Thaana({
  subsets: ["thaana"],
  variable: "--nf-thaana",
  display: "swap",
});

export async function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return {
    title: {
      default: dict.meta.siteName,
      template: `%s · ${dict.meta.siteName}`,
    },
    description: dict.meta.description,
    alternates: {
      languages: Object.fromEntries(LOCALES.map((l) => [l, `/${l}`])),
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#15803d",
};

export default async function RootLayout({
  children,
}: LayoutProps<"/[locale]">) {
  const locale = await getLocale();
  const dict = await getDictionary();

  return (
    <html
      lang={locale}
      dir={LOCALE_DIRECTION[locale]}
      className={`${inter.variable} ${thaana.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:shadow-lg"
        >
          {dict.common.skipToContent}
        </a>
        <SiteHeader locale={locale} dict={dict} />
        <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>
        <SiteFooter dict={dict} />
      </body>
    </html>
  );
}
