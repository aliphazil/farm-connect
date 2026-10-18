import { getSessionUser } from "@/lib/auth/session";
import { renderReceiptPdf } from "@/lib/pdf/finance-pdf";
import { getReceiptDocument } from "@/services/server/finance-queries";

/** Downloadable receipt PDF (farmer, linked buyer, or admin — logged). */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/receipts/[id]/pdf">,
) {
  const user = await getSessionUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  const { id } = await params;
  const doc = await getReceiptDocument(id, user);
  if (!doc) return new Response("Not found", { status: 404 });
  const pdf = await renderReceiptPdf(doc.receipt, doc.payment, doc.invoice);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${doc.receipt.number.replace(/[^A-Za-z0-9-]/g, "")}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
