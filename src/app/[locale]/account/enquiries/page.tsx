import Link from "next/link";
import { placeText } from "@shared/constants/geography";
import { pickLocalized } from "@shared/constants/locales";
import { fill } from "@shared/i18n/format";
import { formatDate } from "@shared/utils/date";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { requireConsumerPortal } from "@/lib/auth/portal-access";
import { listConsumerEnquiries } from "@/services/server/consumer";
import { CancelEnquiryButton } from "@/features/consumer/components/cancel-enquiry-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge, PageHeader } from "@/components/ui/layout-primitives";

const STATUS_TONE = {
  new: "warning",
  accepted: "success",
  declined: "neutral",
  completed: "success",
  cancelled: "neutral",
} as const;

export default async function MyEnquiriesPage() {
  const user = await requireConsumerPortal();
  const [locale, dict, enquiries] = await Promise.all([
    getLocale(),
    getDictionary(),
    listConsumerEnquiries(user.uid),
  ]);
  const t = dict.account.enquiries;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t.title} description={t.intro} />
      {enquiries.length === 0 ? (
        <EmptyState icon="💬" title={t.empty} description={t.emptyBody} />
      ) : (
        <ul className="flex flex-col gap-3">
          {enquiries.map((e) => (
            <li
              key={e.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">
                  {e.product ? (
                    <Link
                      href={localeHref(locale, `/products/${e.productId}`)}
                      className="text-primary hover:underline"
                    >
                      {pickLocalized(e.product.title, locale)}
                    </Link>
                  ) : (
                    <span className="text-muted">{t.productRemoved}</span>
                  )}
                </h2>
                <Badge tone={STATUS_TONE[e.status]}>
                  {dict.enquiryStatus[e.status]}
                </Badge>
              </div>
              <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                {e.farmName ? (
                  <div className="flex gap-2">
                    <dt className="text-muted">{t.farm}:</dt>
                    <dd>
                      <Link
                        href={localeHref(locale, `/farmers/${e.farmerId}`)}
                        className="hover:underline"
                      >
                        {pickLocalized(e.farmName, locale)}
                      </Link>
                    </dd>
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <dt className="text-muted">{t.quantity}:</dt>
                  <dd>
                    {e.quantity} {e.product ? dict.units[e.product.unit] : ""}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-muted">{t.deliverTo}:</dt>
                  <dd>{placeText(e.deliverToPlace, locale)}</dd>
                </div>
                <div className="text-muted">
                  {fill(t.sent, { date: formatDate(e.createdAt, locale) })}
                </div>
              </dl>
              {e.message ? (
                <blockquote className="rounded-lg bg-background p-3 text-sm whitespace-pre-line">
                  {e.message}
                </blockquote>
              ) : null}
              {e.status === "new" || e.status === "accepted" ? (
                <CancelEnquiryButton
                  enquiryId={e.id}
                  labels={{
                    cancel: t.cancel,
                    confirm: t.confirmCancel,
                    failed: t.cancelFailed,
                  }}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
