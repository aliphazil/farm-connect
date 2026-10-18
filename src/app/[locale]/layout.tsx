import { Suspense, type CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Thaana } from "next/font/google";
import localFont from "next/font/local";
import { LOCALE_DIRECTION, LOCALES } from "@shared/constants/locales";
import { getDictionary, getLocale, getSiteConfig } from "@/i18n/server";
import { storageObjectUrl } from "@/features/catalog/images";
import { themeVariables } from "@/lib/branding/theme";
import { isSampleCatalog } from "@/features/catalog/queries";
import { SiteAnalytics } from "@/components/catalog/site-analytics";
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

// Dhivehi typefaces, used with permission (see src/fonts/LICENSE.md). They
// cover Thaana only, so Latin text and digits keep Inter. (next/font needs
// literal option values, so the range is written out twice.)
const faseyha = localFont({
  src: "../../fonts/MV_Faseyha.otf",
  variable: "--nf-faseyha",
  display: "swap",
  preload: false,
  // No generated Arial fallback: it would catch Latin text before Inter.
  adjustFontFallback: false,
  declarations: [
    {
      prop: "unicode-range",
      value: "U+0780-07BF, U+060C, U+061B, U+061F, U+066B-066C, U+FDF2",
    },
  ],
});
const waheed = localFont({
  src: "../../fonts/MV_Waheed.otf",
  variable: "--nf-waheed",
  display: "swap",
  preload: false,
  // No generated Arial fallback: it would catch Latin text before Inter.
  adjustFontFallback: false,
  declarations: [
    {
      prop: "unicode-range",
      value: "U+0780-07BF, U+060C, U+061B, U+061F, U+066B-066C, U+FDF2",
    },
  ],
});

export async function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const [locale, dict, config] = await Promise.all([
    getLocale(),
    getDictionary(),
    getSiteConfig(),
  ]);
  const seoTitle = (
    locale === "dv"
      ? config.seo.title.dv || config.seo.title.en
      : config.seo.title.en || config.seo.title.dv
  ).trim();
  const share = config.seo.shareImagePath
    ? storageObjectUrl(config.seo.shareImagePath)
    : undefined;
  return {
    // Sample-data previews stay out of search results (see app/robots.ts).
    ...(isSampleCatalog ? { robots: { index: false, follow: false } } : {}),
    title: {
      default: seoTitle || dict.meta.siteName,
      template: `%s · ${dict.meta.siteName}`,
    },
    description: dict.meta.description,
    alternates: {
      languages: Object.fromEntries(
        config.languages.enabled.map((l) => [l, `/${l}`]),
      ),
    },
    openGraph: {
      siteName: dict.meta.siteName,
      title: seoTitle || dict.meta.siteName,
      description: dict.meta.description,
      locale,
      ...(share ? { images: [{ url: share }] } : {}),
    },
    ...(config.identity.faviconPath
      ? { icons: { icon: storageObjectUrl(config.identity.faviconPath) } }
      : {}),
  };
}

export async function generateViewport(): Promise<Viewport> {
  const config = await getSiteConfig();
  return { themeColor: config.theme.primary };
}

export default async function RootLayout({
  children,
}: LayoutProps<"/[locale]">) {
  const [locale, dict, config] = await Promise.all([
    getLocale(),
    getDictionary(),
    getSiteConfig(),
  ]);

  return (
    <html
      lang={locale}
      dir={LOCALE_DIRECTION[locale]}
      className={`${inter.variable} ${thaana.variable} ${faseyha.variable} ${waheed.variable} h-full antialiased`}
      style={themeVariables(config.theme) as CSSProperties}
    >
      <body className="flex min-h-full flex-col font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:shadow-lg"
        >
          {dict.common.skipToContent}
        </a>
        <SiteHeader locale={locale} dict={dict} config={config} />
        <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>
        <SiteFooter locale={locale} dict={dict} config={config} />
        {isSampleCatalog ? null : (
          // usePathname() needs a Suspense boundary on dynamic routes.
          <Suspense fallback={null}>
            <SiteAnalytics />
          </Suspense>
        )}
      </body>
    </html>
  );
}
