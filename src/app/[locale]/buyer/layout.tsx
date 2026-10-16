import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { PortalShell } from "@/components/layout/portal-shell";

// Access rules for this portal live in src/lib/auth/portal-access.ts.
export default async function BuyerLayout({
  children,
}: LayoutProps<"/[locale]/buyer">) {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  return (
    <PortalShell
      title={dict.portal.buyer.title}
      navLabel={dict.common.portalNavigation}
      checkingLabel={dict.portal.checkingAccess}
      items={[
        {
          href: localeHref(locale, "/buyer"),
          label: dict.portal.overview,
          exact: true,
        },
      ]}
    >
      {children}
    </PortalShell>
  );
}
