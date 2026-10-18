import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { PortalShell } from "@/components/layout/portal-shell";

// Access rules for this portal live in src/lib/auth/portal-access.ts; every page checks them.
export default async function ConsumerLayout({
  children,
}: LayoutProps<"/[locale]/account">) {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const t = dict.account.nav;
  const href = (path: string) => localeHref(locale, path);
  return (
    <PortalShell
      title={dict.portal.consumer.title}
      navLabel={dict.common.portalNavigation}
      checkingLabel={dict.portal.checkingAccess}
      items={[
        { href: href("/account"), label: t.overview, exact: true },
        { href: href("/account/favourites"), label: t.favourites },
        { href: href("/account/enquiries"), label: t.enquiries },
        { href: href("/account/invoices"), label: t.invoices },
        { href: href("/account/reports"), label: t.reports },
        { href: href("/account/notices"), label: t.notices },
        { href: href("/account/settings"), label: t.settings },
      ]}
    >
      {children}
    </PortalShell>
  );
}
