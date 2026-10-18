import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { requireSignedIn } from "@/lib/auth/session";
import { getInvoiceDocument } from "@/services/server/finance-queries";
import { InvoiceView } from "@/components/finance/invoice-view";
import { PrintButton } from "@/components/finance/print-button";
import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/layout-primitives";

export const metadata: Metadata = { robots: { index: false } };

/**
 * Print-friendly invoice for the owning farmer, the linked buyer, or an
 * administrator (logged). Anyone else sees "not found".
 */
export default async function InvoiceDocumentPage({
  params,
}: PageProps<"/[locale]/documents/invoices/[id]">) {
  const user = await requireSignedIn();
  const { id } = await params;
  const [locale, dict, doc] = await Promise.all([
    getLocale(),
    getDictionary(),
    getInvoiceDocument(decodeURIComponent(id), user),
  ]);
  if (!doc) notFound();
  return (
    <Container className="flex max-w-3xl flex-col gap-4 py-8 print:max-w-none print:py-0">
      <div className="flex flex-wrap gap-2 print:hidden">
        <PrintButton label={dict.finance.print} />
        <a
          href={`/api/invoices/${doc.invoice.id}/pdf`}
          className={buttonClasses("primary", "sm")}
        >
          {dict.finance.downloadPdf}
        </a>
      </div>
      <InvoiceView
        invoice={doc.invoice}
        summary={doc.summary}
        ledger={doc.ledger}
        dict={dict}
        locale={locale}
        receiptHref={(rid) => localeHref(locale, `/documents/receipts/${rid}`)}
      />
    </Container>
  );
}
