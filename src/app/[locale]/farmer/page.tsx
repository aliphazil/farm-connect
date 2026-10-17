import { formatMVR } from "@shared/utils/money";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { requireFarmerPortal } from "@/lib/auth/portal-access";
import { getFarmerProfile, getUserAccount } from "@/services/server/accounts";
import { getFarmerDashboard } from "@/services/server/farmer";
import { FarmStatus } from "@/features/farmer/components/farm-status";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/layout-primitives";

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="flex flex-col gap-1">
      <p className="text-sm text-muted">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}

export default async function FarmerDashboardPage() {
  const user = await requireFarmerPortal();
  const [locale, dict, farm, stats, account] = await Promise.all([
    getLocale(),
    getDictionary(),
    getFarmerProfile(user.uid),
    getFarmerDashboard(user.uid),
    getUserAccount(user.uid),
  ]);
  const t = dict.farmerPortal.dashboard;
  const n = (value: number | null) =>
    value === null ? "—" : value.toLocaleString("en-US");
  const money = (value: number | null) =>
    value === null ? "—" : formatMVR(value, locale);
  const inactive =
    stats.products.draft +
    stats.products.paused +
    stats.products.soldOut +
    stats.products.removed;
  const anyMissing = [
    stats.views,
    stats.contactClicks,
    stats.newEnquiries,
    stats.invoicedLaari,
    stats.paymentsLaari,
  ].some((v) => v === null);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t.title} description={t.intro} />
      {farm ? <FarmStatus farm={farm} dict={dict} /> : null}
      {!user.emailVerified ? (
        <Alert tone="info">{dict.auth.verifyEmail}</Alert>
      ) : null}
      {account?.restrictions?.includes("listings") ? (
        <Alert tone="warning">{dict.restrictionNotices.listings}</Alert>
      ) : null}
      {anyMissing ? <Alert tone="warning">{t.loadFailed}</Alert> : null}

      <section
        aria-label={t.title}
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      >
        <Stat label={t.activeProducts} value={n(stats.products.published)} />
        <Stat
          label={t.inactiveProducts}
          value={n(inactive)}
          hint={t.inactiveHint}
        />
        <Stat label={t.newEnquiries} value={n(stats.newEnquiries)} />
        <Stat label={t.views} value={n(stats.views)} hint={t.viewsHint} />
        <Stat
          label={t.contactClicks}
          value={n(stats.contactClicks)}
          hint={t.contactHint}
        />
        <Stat
          label={t.invoiceTotal}
          value={money(stats.invoicedLaari)}
          hint={t.invoiceHint}
        />
        <Stat label={t.paymentsTotal} value={money(stats.paymentsLaari)} />
        <Stat
          label={t.outstanding}
          value={money(stats.outstandingLaari)}
          hint={t.outstandingHint}
        />
      </section>

      <section aria-labelledby="quick-actions">
        <h2 id="quick-actions" className="mb-3 font-semibold">
          {t.quickActions}
        </h2>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={localeHref(locale, "/farmer/products/new")}>
            {t.addProduct}
          </ButtonLink>
          <ButtonLink
            href={localeHref(locale, "/farmer/enquiries")}
            variant="secondary"
          >
            {t.viewEnquiries}
          </ButtonLink>
          <ButtonLink
            href={localeHref(locale, "/farmer/delivery")}
            variant="secondary"
          >
            {t.setUpDelivery}
          </ButtonLink>
          <ButtonLink
            href={localeHref(locale, "/farmer/profile")}
            variant="secondary"
          >
            {t.completeProfile}
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
