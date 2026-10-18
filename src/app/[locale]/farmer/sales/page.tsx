import Link from "next/link";
import { formatDate } from "@shared/utils/date";
import { formatMVR } from "@shared/utils/money";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { requireFarmerPortal } from "@/lib/auth/portal-access";
import { listFarmerSales } from "@/services/server/finance-queries";
import { InvoiceStatusBadge } from "@/components/finance/invoice-view";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge, PageHeader } from "@/components/ui/layout-primitives";

export default async function FarmerSalesPage() {
  const user = await requireFarmerPortal();
  const [locale, dict, sales] = await Promise.all([
    getLocale(),
    getDictionary(),
    listFarmerSales(user.uid),
  ]);
  const t = dict.sales;
  const newHref = localeHref(locale, "/farmer/sales/new");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t.title}
        description={t.intro}
        actions={<ButtonLink href={newHref}>{t.new}</ButtonLink>}
      />
      {sales.length === 0 ? (
        <EmptyState
          icon="🧾"
          title={t.empty}
          description={t.emptyBody}
          action={<ButtonLink href={newHref}>{t.new}</ButtonLink>}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {sales.map((s) => (
            <li
              key={s.id}
              className="grid gap-2 rounded-xl border border-border bg-surface p-4 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-center"
            >
              <div className="min-w-0">
                <Link
                  href={localeHref(locale, `/farmer/sales/${s.id}`)}
                  className="font-semibold text-primary hover:underline"
                >
                  {s.buyer?.name.en || s.buyer?.name.dv || t.buyer}
                </Link>
                <p className="text-sm text-muted">
                  {formatDate(s.agreedAt ?? s.createdAt, locale)} ·{" "}
                  {s.items.length} {t.items.toLowerCase()}
                </p>
              </div>
              <p className="font-medium">{formatMVR(s.totalLaari, locale)}</p>
              <div className="flex flex-wrap gap-1.5">
                <Badge>{dict.orderStatus[s.status]}</Badge>
                {s.invoice ? (
                  <InvoiceStatusBadge status={s.invoice.status} dict={dict} />
                ) : null}
              </div>
              <p className="text-sm text-muted">
                {s.invoice?.number ??
                  (s.invoice ? dict.finance.draft : t.noInvoice)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
