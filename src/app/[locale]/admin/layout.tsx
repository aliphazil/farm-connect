import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { PortalShell } from "@/components/layout/portal-shell";

// Access rules for this portal live in src/lib/auth/portal-access.ts; every
// page checks them, and every Server Action re-checks the admin permission.
export default async function AdminLayout({
  children,
}: LayoutProps<"/[locale]/admin">) {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const t = dict.admin.nav;
  const href = (path: string) => localeHref(locale, path);
  return (
    <PortalShell
      title={dict.portal.admin.title}
      navLabel={dict.common.portalNavigation}
      checkingLabel={dict.portal.checkingAccess}
      items={[
        { href: href("/admin"), label: t.dashboard, exact: true },
        { href: href("/admin/analytics"), label: t.analytics },
        { href: href("/admin/farmers"), label: t.farmers },
        { href: href("/admin/buyers"), label: t.buyers },
        { href: href("/admin/products"), label: t.listings },
        { href: href("/admin/reports"), label: t.reports },
        { href: href("/admin/appeals"), label: t.appeals },
        { href: href("/admin/payments"), label: t.payments },
        { href: href("/admin/reference"), label: t.reference },
        { href: href("/admin/branding"), label: t.branding },
        { href: href("/admin/settings"), label: t.settings },
        { href: href("/admin/logs"), label: t.logs },
      ]}
    >
      {children}
    </PortalShell>
  );
}
