import Link from "next/link";
import { formatDate } from "@shared/utils/date";
import { formatMVR } from "@shared/utils/money";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { requireAdminPermission } from "@/lib/auth/portal-access";
import { listPendingVerifications } from "@/services/server/finance-queries";
import { PaymentVerification } from "@/features/admin/components/payment-verification";
import { NotAllowed } from "@/components/admin/admin-ui";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/layout-primitives";

export default async function AdminPaymentsPage() {
  const { allowed } = await requireAdminPermission("payments.verify");
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const t = dict.admin;
  const p = t.payments;
  if (!allowed)
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={p.title} description={p.intro} />
        <NotAllowed t={t} />
      </div>
    );
  const pending = await listPendingVerifications();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={p.title} description={p.intro} />
      {pending.length === 0 ? (
        <EmptyState icon="🧾" title={p.empty} />
      ) : (
        <ul className="flex flex-col gap-3">
          {pending.map((e) => (
            <li
              key={e.id}
              className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">
                  {formatMVR(e.amountLaari, locale)}
                </p>
                <p className="text-sm text-muted">
                  {dict.paymentMethods[e.method]} ·{" "}
                  {formatDate(e.receivedAt, locale)}
                </p>
              </div>
              <p className="text-sm">
                {p.farm}: {e.farmName ?? "—"} · {p.invoice}:{" "}
                <Link
                  href={localeHref(
                    locale,
                    `/documents/invoices/${e.invoiceId}`,
                  )}
                  className="text-primary underline"
                >
                  {e.invoiceNumber ?? e.invoiceId}
                </Link>
                {e.reference
                  ? ` · ${dict.finance.reference}: ${e.reference}`
                  : ""}
              </p>
              {e.proofPath ? (
                <a
                  href={`/api/payment-proof?payment=${e.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="self-start text-sm text-primary underline"
                >
                  {p.viewSlip}
                </a>
              ) : null}
              <PaymentVerification
                paymentId={e.id}
                hasEvidence={!!e.proofPath || !!e.reference}
                t={t}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
