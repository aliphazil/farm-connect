import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { dictionaries } from "@shared/i18n";
import { getLocale, withBrandingTexts } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { requireAdminPermission } from "@/lib/auth/portal-access";
import { getDraft } from "@/services/server/branding";
import {
  getReferenceSettings,
  withReferenceLabels,
} from "@/services/server/reference";
import {
  catalogNow,
  getAtollSummaries,
  getCategoryCounts,
  getFeaturedFarmers,
  getFeaturedListings,
  getRecentListings,
  isSampleCatalog,
} from "@/features/catalog/queries";
import { themeVariables } from "@/lib/branding/theme";
import { HomeContent } from "@/components/home/home-content";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Alert } from "@/components/ui/alert";
import { Container } from "@/components/ui/layout-primitives";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Admin-only preview of the saved branding draft: header, homepage and
 * footer rendered with the draft. The public site keeps using the published
 * version; nothing here is cached or shared.
 */
export default async function BrandingPreviewPage() {
  const { allowed } = await requireAdminPermission("branding.manage");
  const locale = await getLocale();
  const base = dictionaries[locale];
  if (!allowed)
    return (
      <Container className="py-10">
        <Alert tone="warning">{base.admin.common.ownerOnly}</Alert>
      </Container>
    );
  const draft = await getDraft();
  const t = base.admin.branding.preview;
  if (!draft)
    return (
      <Container className="flex flex-col gap-3 py-10">
        <Alert tone="info">{t.noDraft}</Alert>
        <Link
          href={localeHref(locale, "/admin/branding")}
          className="text-primary underline"
        >
          {t.back}
        </Link>
      </Container>
    );

  const config = draft.config;
  const ref = await getReferenceSettings();
  const dict = withBrandingTexts(
    withReferenceLabels(base, locale, ref),
    locale,
    config,
  );
  const [featured, recent, farmers, atolls, counts, now] = await Promise.all([
    getFeaturedListings(),
    getRecentListings(4),
    getFeaturedFarmers(),
    getAtollSummaries(),
    getCategoryCounts(),
    catalogNow(),
  ]);

  return (
    <>
      {/* Hide the live site's own header and footer on this page only. */}
      <style>{"body > header, body > footer { display: none; }"}</style>
      <div
        style={{
          ...(themeVariables(config.theme) as CSSProperties),
          background: "var(--background)",
          color: "var(--foreground)",
        }}
        className="font-sans"
      >
        <div
          role="status"
          className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-2 bg-warning px-4 py-2 text-sm font-medium text-white"
        >
          <span>{t.banner}</span>
          <Link
            href={localeHref(locale, "/admin/branding")}
            className="underline"
          >
            {t.back}
          </Link>
        </div>
        <SiteHeader locale={locale} dict={dict} config={config} />
        <HomeContent
          locale={locale}
          dict={dict}
          config={config}
          data={{
            featured,
            recent,
            farmers,
            atolls,
            counts,
            now,
            isSample: isSampleCatalog,
          }}
        />
        <SiteFooter locale={locale} dict={dict} config={config} />
      </div>
    </>
  );
}
