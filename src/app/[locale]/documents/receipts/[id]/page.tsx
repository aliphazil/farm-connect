import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pickLocalized } from "@shared/constants/locales";
import { fill } from "@shared/i18n/format";
import { formatDate } from "@shared/utils/date";
import { formatMVR } from "@shared/utils/money";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { requireSignedIn } from "@/lib/auth/session";
import { getReceiptDocument } from "@/services/server/finance-queries";
import { PrintButton } from "@/components/finance/print-button";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { Badge, Container } from "@/components/ui/layout-primitives";

export const metadata: Metadata = { robots: { index: false } };

export default async function ReceiptDocumentPage({
  params,
}: PageProps<"/[locale]/documents/receipts/[id]">) {
  const user = await requireSignedIn();
  const { id } = await params;
  const [locale, dict, doc] = await Promise.all([
    getLocale(),
    getDictionary(),
    getReceiptDocument(decodeURIComponent(id), user),
  ]);
  if (!doc) notFound();
  const f = dict.finance;
  const { receipt, payment, invoice } = doc;
  const refund = receipt.kind === "refund";
  const status = payment.reversed
    ? dict.paymentStatus.reversed
    : dict.paymentStatus[payment.verificationStatus];

  return (
    <Container className="flex max-w-2xl flex-col gap-4 py-8 print:max-w-none print:py-0">
      <div className="flex flex-wrap gap-2 print:hidden">
        <PrintButton label={f.print} />
        <a
          href={`/api/receipts/${receipt.id}/pdf`}
          className={buttonClasses("primary", "sm")}
        >
          {f.downloadPdf}
        </a>
        <Link
          href={localeHref(locale, `/documents/invoices/${invoice.id}`)}
          className={buttonClasses("ghost", "sm")}
        >
          {f.invoice} {invoice.number}
        </Link>
      </div>
      <article className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-2xl font-bold text-primary">
              {refund ? dict.ledgerKinds.refund : f.receipt}
            </p>
            <p className="mt-1 font-mono text-sm">{receipt.number}</p>
            <p className="text-sm text-muted">
              {fill(f.receiptFor, { number: invoice.number ?? "—" })}
            </p>
          </div>
          <Badge
            tone={
              payment.reversed || payment.verificationStatus === "rejected"
                ? "danger"
                : payment.verificationStatus === "verified"
                  ? "success"
                  : "warning"
            }
          >
            {status}
          </Badge>
        </header>
        <dl className="grid gap-2 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-muted">{refund ? f.refundTo : f.receivedFrom}</dt>
          <dd>{invoice.buyerName}</dd>
          <dt className="text-muted">{f.paidTo}</dt>
          <dd>
            {invoice.sellerName
              ? pickLocalized(invoice.sellerName, locale)
              : "—"}
            {invoice.sellerPlace ? `, ${invoice.sellerPlace}` : ""}
          </dd>
          <dt className="text-muted">{f.paymentDate}</dt>
          <dd>{formatDate(payment.receivedAt, locale)}</dd>
          <dt className="text-muted">{f.method}</dt>
          <dd>{dict.paymentMethods[payment.method]}</dd>
          {payment.reference ? (
            <>
              <dt className="text-muted">{f.reference}</dt>
              <dd>{payment.reference}</dd>
            </>
          ) : null}
        </dl>
        <p className="flex justify-between rounded-lg bg-primary-soft p-3 text-lg font-bold">
          <span>{f.amount}</span>
          <span>
            {refund ? "− " : ""}
            {formatMVR(receipt.amountLaari, locale)}
          </span>
        </p>
        {payment.reversed ? <Alert tone="error">{f.reversedNote}</Alert> : null}
        <footer className="flex flex-col gap-1 border-t border-border pt-3 text-xs text-muted">
          <p>{f.currencyNote}</p>
          <p>{f.disclaimer}</p>
        </footer>
      </article>
    </Container>
  );
}
