import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { PortalShell } from "@/components/layout/portal-shell";

export default async function AdminLayout({
  children,
}: LayoutProps<"/[locale]/admin">) {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  return (
    <PortalShell
      title={dict.portal.admin.title}
      navLabel={dict.common.portalNavigation}
      checkingLabel={dict.portal.checkingAccess}
      items={[
        {
          href: localeHref(locale, "/admin"),
          label: dict.portal.overview,
          exact: true,
        },
      ]}
    >
      {children}
    </PortalShell>
  );
}
