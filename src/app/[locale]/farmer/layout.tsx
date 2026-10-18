import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { PortalShell } from "@/components/layout/portal-shell";

// Access rules for this portal live in src/lib/auth/portal-access.ts; every page checks them.
export default async function FarmerLayout({
  children,
}: LayoutProps<"/[locale]/farmer">) {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const t = dict.farmerPortal.nav;
  const href = (path: string) => localeHref(locale, path);
  return (
    <PortalShell
      title={dict.portal.farmer.title}
      navLabel={dict.common.portalNavigation}
      checkingLabel={dict.portal.checkingAccess}
      items={[
        { href: href("/farmer"), label: t.dashboard, exact: true },
        { href: href("/farmer/products"), label: t.products },
        { href: href("/farmer/enquiries"), label: t.enquiries },
        { href: href("/farmer/sales"), label: dict.sales.nav },
        { href: href("/farmer/analytics"), label: t.analytics },
        { href: href("/farmer/delivery"), label: t.delivery },
        { href: href("/farmer/profile"), label: t.profile },
      ]}
    >
      {children}
    </PortalShell>
  );
}
