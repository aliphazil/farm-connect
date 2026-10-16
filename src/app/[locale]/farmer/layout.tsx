import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { PortalShell } from "@/components/layout/portal-shell";

export default async function FarmerLayout({
  children,
}: LayoutProps<"/[locale]/farmer">) {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  return (
    <PortalShell
      title={dict.portal.farmer.title}
      navLabel={dict.common.portalNavigation}
      checkingLabel={dict.portal.checkingAccess}
      items={[
        {
          href: localeHref(locale, "/farmer"),
          label: dict.portal.overview,
          exact: true,
        },
      ]}
    >
      {children}
    </PortalShell>
  );
}
