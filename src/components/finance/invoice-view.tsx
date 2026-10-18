import Link from "next/link";
import { pickLocalized, type Locale } from "@shared/constants/locales";
import type { Dictionary } from "@shared/i18n";
import { fill } from "@shared/i18n/format";
import type { LedgerSummary } from "@shared/ledger";
import type { Invoice } from "@shared/schemas";
import { formatDate } from "@shared/utils/date";
import { formatMVR } from "@shared/utils/money";
import type { LedgerRow } from "@/services/server/finance-queries";
import { Badge } from "@/components/ui/layout-primitives";

const STATUS_TONE = {
  draft: "neutral",
  issued: "warning",
  partially_paid: "warning",
  paid: "success",
  cancelled: "neutral",
  refunded: "neutral",
} as const;

export function InvoiceStatusBadge({
  status,
  dict,
}: {
  status: Invoice["status"];
  dict: Dictionary;
}) {
  return <Badge tone={STATUS_TONE[status]}>{dict.invoiceStatus[status]}</Badge>;
}

export function PaymentStatusBadge({
  row,
  dict,
}: {
  row: LedgerRow;
  dict: Dictionary;
}) {
  if (row.reversed) return <Badge>{dict.paymentStatus.reversed}</Badge>;
  const tone =
    row.verificationStatus === "verified"
      ? "success"
      : row.verificationStatus === "rejected"
        ? "danger"
        : row.verificationStatus === "pending_verification"
          ? "warning"
          : "neutral";
  return (
    <Badge tone={tone}>{dict.paymentStatus[row.verificationStatus]}</Badge>
  );
}

/**
 * An invoice as a document: parties, lines, totals from the ledger, terms
 * and payments. Used on screen and for printing.
 */
export function InvoiceView({
  invoice,
  summary,
  ledger,
  dict,
  locale,
  receiptHref,
}: {
  invoice: Invoice;
  summary: LedgerSummary;
  ledger: LedgerRow[];
  dict: Dictionary;
  locale: Locale;
  receiptHref?: (receiptId: string) => string;
}) {
  const f = dict.finance;
  const money = (n: number) => formatMVR(n, locale);
  const th = "px-2 py-2 text-start font-medium text-muted";
  const thEnd = "px-2 py-2 text-end font-medium text-muted";
  const td = "px-2 py-2 align-top";

  return (
    <article className="flex flex-col gap-6 rounded-2xl border border-border bg-surface p-6 print:border-0 print:p-0">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-2xl font-bold text-primary">{f.invoice}</p>
          <p className="mt-1 font-mono text-sm">{invoice.number ?? f.draft}</p>
        </div>
        <InvoiceStatusBadge status={invoice.status} dict={dict} />
      </header>

      <div className="grid gap-6 sm:grid-cols-2">
        <section>
          <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
            {f.seller}
          </h2>
          <p className="mt-1 font-semibold">
            {invoice.sellerName
              ? pickLocalized(invoice.sellerName, locale)
              : "—"}
          </p>
          {invoice.sellerPlace ? (
            <p className="text-sm">{invoice.sellerPlace}</p>
          ) : null}
          {invoice.sellerPhone ? (
            <p className="text-sm">{invoice.sellerPhone}</p>
          ) : null}
        </section>
        <section>
          <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
            {f.buyer}
          </h2>
          <p className="mt-1 font-semibold">{invoice.buyerName}</p>
          {invoice.buyerPlace ? (
            <p className="text-sm">{invoice.buyerPlace}</p>
          ) : null}
          {invoice.buyerPhone ? (
            <p className="text-sm">{invoice.buyerPhone}</p>
          ) : null}
        </section>
      </div>

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="text-muted">{f.issueDate}:</dt>
          <dd>
            {invoice.issuedAt ? formatDate(invoice.issuedAt, locale) : "—"}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted">{f.dueDate}:</dt>
          <dd>{invoice.dueAt ? formatDate(invoice.dueAt, locale) : "—"}</dd>
        </div>
      </dl>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <caption className="sr-only">{f.invoice}</caption>
          <thead className="border-b border-border">
            <tr>
              <th scope="col" className={th}>
                {f.item}
              </th>
              <th scope="col" className={thEnd}>
                {f.qty}
              </th>
              <th scope="col" className={th}>
                {f.unit}
              </th>
              <th scope="col" className={thEnd}>
                {f.unitPrice}
              </th>
              <th scope="col" className={thEnd}>
                {f.amount}
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((l, i) => (
              <tr key={i} className="border-b border-border">
                <td className={td}>{pickLocalized(l.title, locale)}</td>
                <td className={`${td} text-end`}>{l.quantity}</td>
                <td className={td}>{dict.units[l.unit]}</td>
                <td className={`${td} text-end`}>{money(l.unitPriceLaari)}</td>
                <td className={`${td} text-end`}>{money(l.totalLaari)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="ms-auto grid w-full max-w-xs gap-1 text-sm">
        {[
          [f.subtotal, money(invoice.subtotalLaari)],
          ...(invoice.discountLaari
            ? [[f.discount, `− ${money(invoice.discountLaari)}`]]
            : []),
          [f.delivery, money(invoice.deliveryFeeLaari)],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <dt className="text-muted">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 border-t border-border pt-1 text-base font-bold">
          <dt>{f.total}</dt>
          <dd>{money(invoice.totalLaari)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">{f.paid}</dt>
          <dd>{money(summary.netPaidLaari)}</dd>
        </div>
        {summary.refundedLaari ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">{f.refunded}</dt>
            <dd>{money(summary.refundedLaari)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-4 font-bold">
          <dt>{f.outstanding}</dt>
          <dd>{money(summary.outstandingLaari)}</dd>
        </div>
        {summary.pendingLaari ? (
          <p className="text-xs text-muted">
            {fill(f.pendingNote, { amount: money(summary.pendingLaari) })}
          </p>
        ) : null}
        {summary.verifiedLaari ? (
          <p className="text-xs text-muted">
            {fill(f.verifiedNote, { amount: money(summary.verifiedLaari) })}
          </p>
        ) : null}
      </dl>

      {invoice.paymentTerms || invoice.notes ? (
        <div className="grid gap-4 text-sm sm:grid-cols-2">
          {invoice.paymentTerms ? (
            <section>
              <h2 className="font-semibold">{f.terms}</h2>
              <p className="whitespace-pre-line">{invoice.paymentTerms}</p>
            </section>
          ) : null}
          {invoice.notes ? (
            <section>
              <h2 className="font-semibold">{f.notes}</h2>
              <p className="whitespace-pre-line">{invoice.notes}</p>
            </section>
          ) : null}
        </div>
      ) : null}

      <section
        aria-labelledby={`payments-${invoice.id}`}
        className="flex flex-col gap-2"
      >
        <h2 id={`payments-${invoice.id}`} className="font-semibold">
          {f.payments}
        </h2>
        {ledger.length === 0 ? (
          <p className="text-sm text-muted">{f.noPayments}</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {ledger.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border pb-2"
              >
                <span>{formatDate(e.receivedAt, locale)}</span>
                <span className="font-medium">{dict.ledgerKinds[e.kind]}</span>
                <span className="text-muted">
                  {dict.paymentMethods[e.method]}
                  {e.reference ? ` · ${e.reference}` : ""}
                </span>
                {e.kind !== "reversal" ? (
                  <PaymentStatusBadge row={e} dict={dict} />
                ) : null}
                <span className="ms-auto font-medium">
                  {e.kind === "refund" ? "− " : ""}
                  {money(e.amountLaari)}
                </span>
                {e.receiptId && e.receiptNumber && receiptHref ? (
                  <Link
                    href={receiptHref(e.receiptId)}
                    className="text-primary underline print:hidden"
                  >
                    {e.receiptNumber}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="flex flex-col gap-1 border-t border-border pt-3 text-xs text-muted">
        <p>{f.currencyNote}</p>
        <p>{f.noTax}</p>
        <p>{f.disclaimer}</p>
      </footer>
    </article>
  );
}
