import { getDictionary } from "@/i18n/server";
import { requireAdminPortal } from "@/lib/auth/portal-access";
import { PortalOverview } from "@/components/layout/portal-overview";

export default async function AdminHome() {
  await requireAdminPortal();
  const dict = await getDictionary();
  const t = dict.portal.admin;
  return (
    <PortalOverview
      title={t.title}
      comingSoonLabel={dict.states.comingSoon}
      sections={[t.users, t.listings, t.reports, t.branding, t.analytics]}
    />
  );
}
