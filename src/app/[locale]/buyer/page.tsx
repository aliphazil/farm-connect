import { getDictionary } from "@/i18n/server";
import { requireBuyerPortal } from "@/lib/auth/portal-access";
import { PortalOverview } from "@/components/layout/portal-overview";

export default async function BuyerHome() {
  await requireBuyerPortal();
  const dict = await getDictionary();
  const t = dict.portal.buyer;
  return (
    <PortalOverview
      title={t.title}
      comingSoonLabel={dict.states.comingSoon}
      sections={[t.enquiries, t.invoices, t.profile]}
    />
  );
}
