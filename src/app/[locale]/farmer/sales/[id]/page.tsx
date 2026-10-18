import Link from "next/link";
import { notFound } from "next/navigation";
import { fill } from "@shared/i18n/format";
import { formatDate } from "@shared/utils/date";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { requireFarmerPortal } from "@/lib/auth/portal-access";
import { getFarmerOrder } from "@/services/server/finance-queries";
import {
  InvoiceControls,
  InvoiceCreateForm,
  OrderStatusControls,
  PaymentForm,
  ReverseButton,
} from "@/features/finance/components/finance-forms";
import {
  InvoiceView,
  PaymentStatusBadge,
} from "@/components/finance/invoice-view";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { buttonClasses } from "@/components/ui/button";
import { Badge, Card, PageHeader } from "@/components/ui/layout-primitives";

export default async function SaleDetailPage({
  params,
}: PageProps<"/[locale]/farmer/sales/[id]">) {
  const user = await requireFarmerPortal();
  const { id } = await params;
  const [locale, dict, detail] = await Promise.all([
    getLocale(),
    getDictionary(),
    getFarmerOrder(user.uid, decodeURIComponent(id)),
  ]);
  if (!detail) notFound();
  const t = dict.sales;
  const { order, invoice, ledger, summary } = detail;
  const receiptHref = (rid: string) =>
    localeHref(locale, `/documents/receipts/${rid}`);
  const moneyRecorded =
    !!summary && (summary.receivedLaari > 0 || summary.refundedLaari > 0);
  const invoiceOpen =
    invoice && ["issued", "partially_paid"].includes(invoice.status);
  const canRefund =
    invoice &&
    ["partially_paid", "paid"].includes(invoice.status) &&
    (summary?.netPaidLaari ?? 0) > 0;

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumbs
        label={dict.common.breadcrumb}
        items={[
          { label: t.title, href: localeHref(locale, "/farmer/sales") },
          { label: t.orderTitle },
        ]}
      />
      <PageHeader
        title={`${t.orderTitle}: ${order.buyer?.name.en || order.buyer?.name.dv || t.buyer}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge>{dict.orderStatus[order.status]}</Badge>
            <span>
              {fill(t.agreed, {
                date: formatDate(order.agreedAt ?? order.createdAt, locale),
              })}
            </span>
          </span>
        }
      />
      <OrderStatusControls
        orderId={order.id}
        status={order.status}
        canCancel={!invoice || ["draft", "cancelled"].includes(invoice.status)}
        dict={dict}
      />

      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">{t.invoice}</h2>
        {!invoice || invoice.status === "cancelled" ? (
          order.status === "cancelled" ? (
            <p className="text-sm text-muted">{t.noInvoice}</p>
          ) : (
            <InvoiceCreateForm orderId={order.id} dict={dict} />
          )
        ) : (
          <div className="flex flex-wrap items-start gap-3">
            <Link
              href={localeHref(locale, `/documents/invoices/${invoice.id}`)}
              className={buttonClasses("secondary", "sm")}
            >
              {t.view}
            </Link>
            <a
              href={`/api/invoices/${invoice.id}/pdf`}
              className={buttonClasses("ghost", "sm")}
            >
              {dict.finance.downloadPdf}
            </a>
            <InvoiceControls
              invoiceId={invoice.id}
              status={invoice.status}
              canCancel={
                invoice.status === "draft" ||
                (invoice.status === "issued" && !moneyRecorded)
              }
              dict={dict}
            />
          </div>
        )}
      </Card>

      {invoice && summary ? (
        <>
          <InvoiceView
            invoice={invoice}
            summary={summary}
            ledger={ledger}
            dict={dict}
            locale={locale}
            receiptHref={receiptHref}
          />
          <Card className="flex flex-col gap-3">
            <h2 className="font-semibold">{t.ledger}</h2>
            {invoiceOpen ? (
              <PaymentForm
                invoiceId={invoice.id}
                kind="payment"
                maxLaari={summary.outstandingLaari}
                dict={dict}
                locale={locale}
              />
            ) : null}
            {canRefund ? (
              <PaymentForm
                invoiceId={invoice.id}
                kind="refund"
                maxLaari={summary.netPaidLaari}
                dict={dict}
                locale={locale}
              />
            ) : null}
            <ul className="flex flex-col gap-3">
              {ledger
                .filter((e) => e.kind !== "reversal")
                .map((e) => (
                  <li
                    key={e.id}
                    className="flex flex-wrap items-center gap-3 text-sm"
                  >
                    <span className="font-medium">
                      {dict.ledgerKinds[e.kind]}
                    </span>
                    <PaymentStatusBadge row={e} dict={dict} />
                    {e.proofPath ? (
                      <a
                        href={`/api/payment-proof?payment=${e.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        {t.proofLink}
                      </a>
                    ) : null}
                    {!e.reversed && e.verificationStatus !== "verified" ? (
                      <ReverseButton paymentId={e.id} dict={dict} />
                    ) : null}
                  </li>
                ))}
            </ul>
          </Card>
        </>
      ) : null}
    </div>
  );
}
