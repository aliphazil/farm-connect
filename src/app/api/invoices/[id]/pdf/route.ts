import { getSessionUser } from "@/lib/auth/session";
import { renderInvoicePdf } from "@/lib/pdf/finance-pdf";
import { getInvoiceDocument } from "@/services/server/finance-queries";

/**
 * Downloadable invoice PDF for the owning farmer, the linked buyer, or an
 * administrator (whose access is logged). Anyone else gets 404.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/invoices/[id]/pdf">,
) {
  const user = await getSessionUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  const { id } = await params;
  const doc = await getInvoiceDocument(id, user);
  if (!doc) return new Response("Not found", { status: 404 });
  const pdf = await renderInvoicePdf(doc.invoice, doc.ledger, doc.summary);
  const name = (doc.invoice.number ?? `draft-${doc.invoice.id}`).replace(
    /[^A-Za-z0-9-]/g,
    "",
  );
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
