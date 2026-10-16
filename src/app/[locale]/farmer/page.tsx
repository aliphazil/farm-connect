import { getDictionary } from "@/i18n/server";
import { requireFarmerPortal } from "@/lib/auth/portal-access";
import { PortalOverview } from "@/components/layout/portal-overview";

export default async function FarmerHome() {
  await requireFarmerPortal();
  const dict = await getDictionary();
  const t = dict.portal.farmer;
  return (
    <PortalOverview
      title={t.title}
      comingSoonLabel={dict.states.comingSoon}
      sections={[t.listings, t.enquiries, t.invoices, t.payments, t.profile]}
    />
  );
}
