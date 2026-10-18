import { placeText } from "@shared/constants/geography";
import { pickLocalized } from "@shared/constants/locales";
import { fill } from "@shared/i18n/format";
import { formatDate } from "@shared/utils/date";
import { getDictionary, getLocale } from "@/i18n/server";
import { requireFarmerPortal } from "@/lib/auth/portal-access";
import { getFarmerProfile, getUserAccount } from "@/services/server/accounts";
import { ReportForm } from "@/features/consumer/components/report-form";
import { listFarmerEnquiries } from "@/services/server/farmer";
import { EnquiryActions } from "@/features/farmer/components/enquiry-actions";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge, PageHeader } from "@/components/ui/layout-primitives";

const STATUS_TONE = {
  new: "warning",
  accepted: "success",
  declined: "neutral",
  completed: "success",
  cancelled: "neutral",
} as const;

export default async function FarmerEnquiriesPage() {
  const user = await requireFarmerPortal();
  const [locale, dict, enquiries, farm, account] = await Promise.all([
    getLocale(),
    getDictionary(),
    listFarmerEnquiries(user.uid),
    getFarmerProfile(user.uid),
    getUserAccount(user.uid),
  ]);
  const canReport = !account?.restrictions?.includes("reports");
  const t = dict.farmerPortal.enquiries;
  const farmName = farm ? pickLocalized(farm.farmName, locale) : "";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t.title} description={t.intro} />
      {enquiries.length === 0 ? (
        <EmptyState icon="💬" title={t.empty} description={t.emptyBody} />
      ) : (
        <ul className="flex flex-col gap-3">
          {enquiries.map((e) => {
            const productTitle = e.product
              ? pickLocalized(e.product.title, locale)
              : e.productId;
            const unit = e.product ? dict.units[e.product.unit] : "";
            return (
              <li
                key={e.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold">{productTitle}</h2>
                  <Badge tone={STATUS_TONE[e.status]}>
                    {dict.enquiryStatus[e.status]}
                  </Badge>
                </div>
                <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <div className="flex gap-2">
                    <dt className="text-muted">{t.from}:</dt>
                    <dd>{e.consumerName ?? t.buyer}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted">{t.quantity}:</dt>
                    <dd>
                      {e.quantity} {unit}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-muted">{t.deliverTo}:</dt>
                    <dd>{placeText(e.deliverToPlace, locale)}</dd>
                  </div>
                  <div className="text-muted">
                    {fill(t.received, {
                      date: formatDate(e.createdAt, locale),
                    })}
                  </div>
                </dl>
                {e.message ? (
                  <blockquote className="rounded-lg bg-background p-3 text-sm whitespace-pre-line">
                    <span className="sr-only">{t.message}: </span>
                    {e.message}
                  </blockquote>
                ) : null}
                <EnquiryActions
                  enquiryId={e.id}
                  status={e.status}
                  consumerPhone={e.consumerPhone}
                  farmName={farmName}
                  productTitle={productTitle}
                  dict={dict}
                />
                {canReport ? (
                  <ReportForm
                    targetType="enquiry"
                    targetId={e.id}
                    dict={dict}
                    locale={locale}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
