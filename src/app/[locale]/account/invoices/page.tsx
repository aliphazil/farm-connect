import Link from "next/link";
import { pickLocalized } from "@shared/constants/locales";
import { formatDate } from "@shared/utils/date";
import { formatMVR } from "@shared/utils/money";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { requireConsumerPortal } from "@/lib/auth/portal-access";
import { listConsumerFinance } from "@/services/server/consumer";
import { InvoiceStatusBadge } from "@/components/finance/invoice-view";
import { Badge, PageHeader } from "@/components/ui/layout-primitives";

export default async function MyInvoicesPage() {
  const user = await requireConsumerPortal();
  const [locale, dict, { invoices, payments }] = await Promise.all([
    getLocale(),
    getDictionary(),
    listConsumerFinance(user.uid),
  ]);
  const t = dict.account.invoices;
  const money = (laari: number) => formatMVR(laari, locale);
  const th = "px-3 py-2 text-start font-medium text-muted";
  const td = "px-3 py-2";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t.title} description={t.intro} />

      <section aria-labelledby="invoices">
        <h2 id="invoices" className="mb-3 text-lg font-semibold">
          {t.invoicesTitle}
        </h2>
        {invoices.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-surface p-4 text-sm text-muted">
            {t.noInvoices}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full min-w-[36rem] text-sm">
              <caption className="sr-only">{t.invoicesTitle}</caption>
              <thead className="border-b border-border">
                <tr>
                  {[
                    t.number,
                    dict.account.enquiries.farm,
                    t.date,
                    t.total,
                    t.paid,
                    t.balance,
                    t.status,
                  ].map((h) => (
                    <th key={h} scope="col" className={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr
                    key={i.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className={`${td} font-medium`}>
                      <Link
                        href={localeHref(locale, `/documents/invoices/${i.id}`)}
                        className="text-primary underline"
                      >
                        {i.number ?? "—"}
                      </Link>
                    </td>
                    <td className={td}>
                      {i.farmName ? pickLocalized(i.farmName, locale) : "—"}
                    </td>
                    <td className={td}>
                      {formatDate(i.issuedAt ?? i.createdAt, locale)}
                    </td>
                    <td className={td}>{money(i.totalLaari)}</td>
                    <td className={td}>{money(i.paidLaari)}</td>
                    <td className={td}>
                      {i.status === "cancelled" || i.status === "refunded"
                        ? "—"
                        : money(Math.max(0, i.totalLaari - i.paidLaari))}
                    </td>
                    <td className={td}>
                      <InvoiceStatusBadge status={i.status} dict={dict} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="payments">
        <h2 id="payments" className="mb-3 text-lg font-semibold">
          {t.paymentsTitle}
        </h2>
        {payments.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-surface p-4 text-sm text-muted">
            {t.noPayments}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full min-w-[32rem] text-sm">
              <caption className="sr-only">{t.paymentsTitle}</caption>
              <thead className="border-b border-border">
                <tr>
                  {[
                    t.date,
                    t.number,
                    dict.finance.kind,
                    t.method,
                    t.amount,
                    t.status,
                    dict.finance.receipt,
                  ].map((h) => (
                    <th key={h} scope="col" className={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments
                  .filter((p) => p.kind !== "reversal")
                  .map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className={td}>{formatDate(p.receivedAt, locale)}</td>
                      <td className={td}>{p.invoiceNumber ?? "—"}</td>
                      <td className={td}>{dict.ledgerKinds[p.kind]}</td>
                      <td className={td}>{dict.paymentMethods[p.method]}</td>
                      <td className={td}>
                        {p.kind === "refund" ? "− " : ""}
                        {money(p.amountLaari)}
                      </td>
                      <td className={td}>
                        <Badge
                          tone={
                            p.reversed || p.verificationStatus === "rejected"
                              ? "danger"
                              : p.verificationStatus === "verified"
                                ? "success"
                                : "neutral"
                          }
                        >
                          {p.reversed
                            ? dict.paymentStatus.reversed
                            : dict.paymentStatus[p.verificationStatus]}
                        </Badge>
                      </td>
                      <td className={td}>
                        {p.receiptId ? (
                          <Link
                            href={localeHref(
                              locale,
                              `/documents/receipts/${p.receiptId}`,
                            )}
                            className="text-primary underline"
                          >
                            {dict.finance.receipt}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
