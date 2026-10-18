import "server-only";

import { COLLECTIONS } from "@shared/firestore-paths";
import { summarizeLedger, type LedgerSummary } from "@shared/ledger";
import {
  invoiceSchema,
  orderSchema,
  paymentRecordSchema,
  receiptSchema,
  type Invoice,
  type Order,
  type PaymentRecord,
  type Receipt,
} from "@shared/schemas";
import { adminCan, adminLevelOf } from "@shared/constants/admin";
import { getAdminDb } from "@/lib/firebase/admin";
import { col, isDocId, snapToModel } from "./db";
import { logFinanceView } from "./admin";

/**
 * Read models for transactions, invoices, ledgers and receipts. Access is
 * decided here for every document: the owning farmer, the linked buyer, or
 * an administrator (whose access is logged). Anyone else gets nothing.
 */

export type Viewer = { uid: string; role: string | null; adminLevel?: string };

const parse = <T>(fn: () => T | null): T | null => {
  try {
    return fn();
  } catch {
    return null;
  }
};

export type LedgerRow = PaymentRecord & { receiptNumber?: string };

async function ledgerFor(invoiceId: string): Promise<LedgerRow[]> {
  const snap = await col(COLLECTIONS.payments)
    .where("invoiceId", "==", invoiceId)
    .get();
  const entries = snap.docs
    .map((d) => parse(() => snapToModel(paymentRecordSchema, d)))
    .filter((p): p is PaymentRecord => p !== null)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const receiptIds = entries
    .map((e) => e.receiptId)
    .filter(Boolean) as string[];
  const receipts = receiptIds.length
    ? await getAdminDb().getAll(
        ...receiptIds.map((id) => col(COLLECTIONS.receipts).doc(id)),
      )
    : [];
  const numbers = new Map(
    receipts.map((r) => [r.id, r.get("number") as string]),
  );
  return entries.map((e) => ({
    ...e,
    receiptNumber: e.receiptId ? numbers.get(e.receiptId) : undefined,
  }));
}

function summary(invoice: Invoice, ledger: PaymentRecord[]): LedgerSummary {
  return summarizeLedger(
    ledger.map((e) => ({
      kind: e.kind,
      amountLaari: e.amountLaari,
      verificationStatus: e.verificationStatus,
      reversed: e.reversed,
    })),
    invoice.totalLaari,
  );
}

type Access = "farmer" | "buyer" | "admin";

function accessTo(
  record: { farmerId: string; consumerId?: string },
  viewer: Viewer,
): Access | null {
  if (record.farmerId === viewer.uid) return "farmer";
  if (record.consumerId && record.consumerId === viewer.uid) return "buyer";
  if (
    viewer.role === "admin" &&
    adminCan(adminLevelOf(viewer.adminLevel), "admin.view")
  )
    return "admin";
  return null;
}

// ---------- farmer ----------

export type SaleRow = Order & { invoice: Invoice | null };

export async function listFarmerSales(uid: string): Promise<SaleRow[]> {
  const snap = await col(COLLECTIONS.orders).where("farmerId", "==", uid).get();
  const orders = snap.docs
    .map((d) => parse(() => snapToModel(orderSchema, d)))
    .filter((o): o is Order => o !== null)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const ids = orders.map((o) => o.invoiceId).filter(Boolean) as string[];
  const invoices = ids.length
    ? await getAdminDb().getAll(
        ...ids.map((id) => col(COLLECTIONS.invoices).doc(id)),
      )
    : [];
  const byId = new Map(
    invoices.map(
      (s) => [s.id, parse(() => snapToModel(invoiceSchema, s))] as const,
    ),
  );
  return orders.map((o) => ({
    ...o,
    invoice: o.invoiceId ? (byId.get(o.invoiceId) ?? null) : null,
  }));
}

export type FarmerOrderDetail = {
  order: Order;
  invoice: Invoice | null;
  ledger: LedgerRow[];
  summary: LedgerSummary | null;
};

export async function getFarmerOrder(
  uid: string,
  orderId: string,
): Promise<FarmerOrderDetail | null> {
  if (!isDocId(orderId)) return null;
  const snap = await col(COLLECTIONS.orders).doc(orderId).get();
  const order = parse(() => snapToModel(orderSchema, snap));
  if (!order || order.farmerId !== uid) return null;
  const invSnap = order.invoiceId
    ? await col(COLLECTIONS.invoices).doc(order.invoiceId).get()
    : null;
  const invoice = invSnap
    ? parse(() => snapToModel(invoiceSchema, invSnap))
    : null;
  const ledger = invoice ? await ledgerFor(invoice.id) : [];
  return {
    order,
    invoice,
    ledger,
    summary: invoice ? summary(invoice, ledger) : null,
  };
}

/** The farmer's accepted enquiries (to start a transaction from). */
export async function getEnquiryForSale(uid: string, enquiryId: string) {
  if (!isDocId(enquiryId)) return null;
  const e = await col(COLLECTIONS.enquiries).doc(enquiryId).get();
  if (!e.exists || e.get("farmerId") !== uid) return null;
  const product = await col(COLLECTIONS.products).doc(e.get("productId")).get();
  return {
    id: e.id,
    status: e.get("status") as string,
    consumerName: (e.get("consumerName") as string | undefined) ?? null,
    quantity: e.get("quantity") as number,
    product: product.exists
      ? {
          id: product.id,
          title: product.get("title"),
          unit: product.get("unit"),
          priceLaari: product.get("priceLaari") as number,
        }
      : null,
  };
}

// ---------- documents (farmer, buyer, admin) ----------

export type InvoiceDocument = {
  invoice: Invoice;
  ledger: LedgerRow[];
  summary: LedgerSummary;
  access: Access;
};

/** An invoice for printing/PDF, if this viewer may see it (admin views logged). */
export async function getInvoiceDocument(
  invoiceId: string,
  viewer: Viewer,
): Promise<InvoiceDocument | null> {
  if (!isDocId(invoiceId)) return null;
  const snap = await col(COLLECTIONS.invoices).doc(invoiceId).get();
  const invoice = parse(() => snapToModel(invoiceSchema, snap));
  if (!invoice) return null;
  const access = accessTo(invoice, viewer);
  if (!access) return null;
  // Buyers see issued invoices only, not the farmer's drafts.
  if (access === "buyer" && invoice.status === "draft") return null;
  if (access === "admin")
    await logFinanceView(
      { ...viewer, adminLevel: adminLevelOf(viewer.adminLevel) },
      "invoice",
      invoice.id,
    );
  const ledger = await ledgerFor(invoice.id);
  return { invoice, ledger, summary: summary(invoice, ledger), access };
}

export type ReceiptDocument = {
  receipt: Receipt;
  payment: PaymentRecord;
  invoice: Invoice;
  access: Access;
};

export async function getReceiptDocument(
  receiptId: string,
  viewer: Viewer,
): Promise<ReceiptDocument | null> {
  if (!isDocId(receiptId)) return null;
  const snap = await col(COLLECTIONS.receipts).doc(receiptId).get();
  const receipt = parse(() => snapToModel(receiptSchema, snap));
  if (!receipt) return null;
  const access = accessTo(receipt, viewer);
  if (!access) return null;
  const [paymentSnap, invoiceSnap] = await Promise.all([
    col(COLLECTIONS.payments).doc(receipt.paymentId).get(),
    col(COLLECTIONS.invoices).doc(receipt.invoiceId).get(),
  ]);
  const payment = parse(() => snapToModel(paymentRecordSchema, paymentSnap));
  const invoice = parse(() => snapToModel(invoiceSchema, invoiceSnap));
  if (!payment || !invoice) return null;
  if (access === "admin")
    await logFinanceView(
      { ...viewer, adminLevel: adminLevelOf(viewer.adminLevel) },
      "receipt",
      receipt.id,
    );
  return { receipt, payment, invoice, access };
}

// ---------- admin ----------

export type PendingPaymentRow = PaymentRecord & {
  invoiceNumber?: string;
  farmName?: string;
};

export async function listPendingVerifications(): Promise<PendingPaymentRow[]> {
  const snap = await col(COLLECTIONS.payments)
    .where("verificationStatus", "==", "pending_verification")
    .limit(100)
    .get();
  const entries = snap.docs
    .map((d) => parse(() => snapToModel(paymentRecordSchema, d)))
    .filter((p): p is PaymentRecord => p !== null && !p.reversed)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  if (!entries.length) return [];
  const db = getAdminDb();
  const [invoices, farms] = await Promise.all([
    db.getAll(
      ...[...new Set(entries.map((e) => e.invoiceId))].map((id) =>
        col(COLLECTIONS.invoices).doc(id),
      ),
    ),
    db.getAll(
      ...[...new Set(entries.map((e) => e.farmerId))].map((id) =>
        col(COLLECTIONS.farmerProfiles).doc(id),
      ),
    ),
  ]);
  const numbers = new Map(
    invoices.map((i) => [i.id, i.get("number") as string | undefined]),
  );
  const names = new Map(
    farms.map((f) => {
      const n = f.get("farmName") as { en?: string; dv?: string } | undefined;
      return [f.id, n?.en || n?.dv];
    }),
  );
  return entries.map((e) => ({
    ...e,
    invoiceNumber: numbers.get(e.invoiceId),
    farmName: names.get(e.farmerId),
  }));
}
