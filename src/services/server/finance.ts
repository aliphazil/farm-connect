import "server-only";

import { createHash } from "node:crypto";
import type {
  DocumentReference,
  DocumentSnapshot,
  Transaction,
} from "firebase-admin/firestore";
import { placeText } from "@shared/constants/geography";
import type { LocalizedText } from "@shared/constants/locales";
import {
  COLLECTIONS,
  UPLOAD_LIMITS,
  storagePaths,
} from "@shared/firestore-paths";
import {
  CURRENCY,
  TotalsError,
  computeTotals,
  deriveInvoiceState,
  effectiveAmount,
  normalizeQuantity,
  summarizeLedger,
  type InvoiceState,
  type LedgerEntry,
} from "@shared/ledger";
import {
  VERIFIABLE_METHODS,
  invoiceInputSchema,
  orderInputSchema,
  paymentInputSchema,
  type InvoiceInput,
  type OrderInput,
  type PaymentInput,
} from "@shared/schemas";
import { getAdminDb, getAdminStorage } from "@/lib/firebase/admin";
import { addAdminLog, col, serverNow } from "./db";
import { getIslandMap, toPlace } from "./farmer";

/**
 * Transactions, invoices, the payment ledger and receipts. Every financial
 * write goes through here (Security Rules forbid client writes):
 *
 * - Only the farmer who owns a record can change it; buyers only read.
 * - Names, units and agreed prices are snapshotted when the transaction is
 *   made, so later listing edits never change history.
 * - Invoice numbers are assigned at issue from a per-farmer counter and
 *   guarded globally (`documentNumbers/{number}`), so no two are the same.
 * - The amount paid, outstanding balance and status are recomputed from the
 *   ledger inside the same transaction as every ledger change; nothing
 *   trusts a stored balance.
 * - The ledger is append-only: corrections are reversals or refunds. A
 *   transfer is "verified" only by an administrator with evidence
 *   (admin.ts verifyPayment); farmers can't verify their own payments.
 * - No tax is calculated, and no payment is processed or invented.
 */

export type FinanceErrorCode =
  | "not_found"
  | "forbidden"
  | "invalid_input"
  | "invalid_state"
  | "overpayment"
  | "refund_exceeds_paid"
  | "discount_exceeds_subtotal"
  | "already_invoiced"
  | "enquiry_not_accepted"
  | "proof_invalid"
  | "account_inactive";

export class FinanceError extends Error {
  constructor(public readonly code: FinanceErrorCode) {
    super(code);
    this.name = "FinanceError";
  }
}

export type FinanceActor = {
  uid: string;
  role: string | null;
  adminLevel?: string;
};

const db = () => getAdminDb();

/** The farmer must be an active farmer (not suspended, blocked or a buyer). */
async function assertActiveFarmer(actor: FinanceActor) {
  if (actor.role !== "farmer") throw new FinanceError("forbidden");
  const user = await col(COLLECTIONS.users).doc(actor.uid).get();
  if (!user.exists || user.get("status") !== "active")
    throw new FinanceError("account_inactive");
}

function ownDoc(snap: DocumentSnapshot, farmerId: string) {
  if (!snap.exists) throw new FinanceError("not_found");
  if (snap.get("farmerId") !== farmerId) throw new FinanceError("not_found");
}

/** Short, stable tag per farmer for document numbers. */
export function farmerTag(uid: string): string {
  return createHash("sha256")
    .update(uid)
    .digest("hex")
    .slice(0, 6)
    .toUpperCase();
}

/** Reserves the next number of a kind for a farmer inside a transaction. */
function nextNumber(
  tx: Transaction,
  counter: DocumentSnapshot,
  kind: "invoice" | "receipt",
  farmerId: string,
): string {
  const n = ((counter.get(kind) as number | undefined) ?? 0) + 1;
  const number = `${kind === "invoice" ? "INV" : "RCT"}-${farmerTag(farmerId)}-${String(n).padStart(4, "0")}`;
  tx.set(counter.ref, { [kind]: n, updatedAt: serverNow() }, { merge: true });
  // Fails the whole transaction if this number was ever used.
  tx.create(col(COLLECTIONS.documentNumbers).doc(number), {
    kind,
    farmerId,
    createdAt: serverNow(),
  });
  return number;
}

// ---------------------------------------------------------------------------
// Transactions (orders)
// ---------------------------------------------------------------------------

const textOf = (t: LocalizedText) => t.en || t.dv || "";

/** Creates an agreed transaction with snapshots of names and prices. */
export async function createOrder(
  actor: FinanceActor,
  input: OrderInput,
): Promise<string> {
  await assertActiveFarmer(actor);
  const parsed = orderInputSchema.safeParse(input);
  if (!parsed.success) throw new FinanceError("invalid_input");
  const data = parsed.data;

  const [farm, islands] = await Promise.all([
    col(COLLECTIONS.farmerProfiles).doc(actor.uid).get(),
    getIslandMap(),
  ]);
  if (!farm.exists) throw new FinanceError("forbidden");
  const loc = farm.get("location") as { atollCode: string; islandId: string };
  const seller = {
    name: farm.get("farmName") as LocalizedText,
    phone: farm.get("contact.phone") as string | undefined,
    place: placeText(
      toPlace(islands, loc.atollCode as never, loc.islandId),
      "en",
    ),
  };

  // Buyer: from an accepted enquiry (linked account, consent-shared phone),
  // or an off-platform buyer by name.
  let buyer: { name: LocalizedText; phone?: string; place?: string };
  let consumerId: string | undefined;
  let deliverTo: { atollCode: string; islandId: string } | undefined;
  if (data.enquiryId) {
    const e = await col(COLLECTIONS.enquiries).doc(data.enquiryId).get();
    if (!e.exists || e.get("farmerId") !== actor.uid)
      throw new FinanceError("not_found");
    if (!["accepted", "completed"].includes(e.get("status")))
      throw new FinanceError("enquiry_not_accepted");
    consumerId = e.get("consumerId");
    deliverTo = e.get("deliverTo");
    const account = await col(COLLECTIONS.users).doc(consumerId!).get();
    const name =
      (e.get("consumerName") as string | undefined) ??
      (account.get("displayName") as string) ??
      "Buyer";
    buyer = {
      name: { en: name },
      ...(e.get("consumerPhone") ? { phone: e.get("consumerPhone") } : {}),
      ...(deliverTo
        ? {
            place: placeText(
              toPlace(
                islands,
                deliverTo.atollCode as never,
                deliverTo.islandId,
              ),
              "en",
            ),
          }
        : {}),
    };
  } else {
    if (!data.buyerName) throw new FinanceError("invalid_input");
    buyer = {
      name: { en: data.buyerName },
      ...(data.buyerPhone ? { phone: data.buyerPhone } : {}),
    };
  }

  // Lines: own products are snapshotted; anything else needs a name.
  const productIds = [
    ...new Set(data.items.map((i) => i.productId).filter(Boolean)),
  ] as string[];
  const products = productIds.length
    ? await db().getAll(
        ...productIds.map((id) => col(COLLECTIONS.products).doc(id)),
      )
    : [];
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines = data.items.map((i) => {
    let title: LocalizedText;
    if (i.productId) {
      const p = byId.get(i.productId);
      if (!p?.exists || p.get("farmerId") !== actor.uid)
        throw new FinanceError("invalid_input");
      title = p.get("title");
    } else {
      if (!i.title?.trim()) throw new FinanceError("invalid_input");
      title = { en: i.title.trim() };
    }
    return {
      ...(i.productId ? { productId: i.productId } : {}),
      title,
      quantity: normalizeQuantity(i.quantity),
      unit: i.unit,
      unitPriceLaari: i.unitPriceLaari,
    };
  });

  let totals;
  try {
    totals = computeTotals(lines, data.discountLaari, data.deliveryFeeLaari);
  } catch (e) {
    if (e instanceof TotalsError)
      throw new FinanceError(
        e.code === "discount_exceeds_subtotal"
          ? "discount_exceeds_subtotal"
          : "invalid_input",
      );
    throw e;
  }

  const ref = col(COLLECTIONS.orders).doc();
  await ref.set({
    farmerId: actor.uid,
    ...(consumerId ? { consumerId } : {}),
    ...(data.enquiryId ? { enquiryId: data.enquiryId } : {}),
    seller,
    buyer,
    items: lines.map((l, i) => ({ ...l, totalLaari: totals.lineTotals[i] })),
    subtotalLaari: totals.subtotalLaari,
    discountLaari: totals.discountLaari,
    deliveryFeeLaari: totals.deliveryFeeLaari,
    totalLaari: totals.totalLaari,
    currency: CURRENCY,
    ...(deliverTo ? { deliverTo } : {}),
    status: "confirmed",
    ...(data.notes ? { notes: data.notes } : {}),
    agreedAt: serverNow(),
    createdAt: serverNow(),
    updatedAt: serverNow(),
  });
  return ref.id;
}

/** Marks a transaction delivered, or cancels it (only without money recorded). */
export async function setOrderStatus(
  actor: FinanceActor,
  orderId: string,
  status: "delivered" | "cancelled",
) {
  await assertActiveFarmer(actor);
  const ref = col(COLLECTIONS.orders).doc(orderId);
  await db().runTransaction(async (tx) => {
    const order = await tx.get(ref);
    ownDoc(order, actor.uid);
    const current = order.get("status");
    if (current === "cancelled") throw new FinanceError("invalid_state");
    if (status === "delivered" && current === "delivered")
      throw new FinanceError("invalid_state");
    if (status === "cancelled") {
      const invoiceId = order.get("invoiceId") as string | undefined;
      if (invoiceId) {
        const invoice = await tx.get(col(COLLECTIONS.invoices).doc(invoiceId));
        if (
          invoice.exists &&
          !["draft", "cancelled"].includes(invoice.get("status"))
        )
          throw new FinanceError("invalid_state");
      }
    }
    tx.update(ref, {
      status,
      [status === "delivered" ? "deliveredAt" : "cancelledAt"]: serverNow(),
      updatedAt: serverNow(),
    });
  });
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

/** A draft invoice from a transaction (copies its snapshots). */
export async function createInvoice(
  actor: FinanceActor,
  input: InvoiceInput,
): Promise<string> {
  await assertActiveFarmer(actor);
  const parsed = invoiceInputSchema.safeParse(input);
  if (!parsed.success) throw new FinanceError("invalid_input");
  const data = parsed.data;
  const orderRef = col(COLLECTIONS.orders).doc(data.orderId);
  const invoiceRef = col(COLLECTIONS.invoices).doc();

  await db().runTransaction(async (tx) => {
    const order = await tx.get(orderRef);
    ownDoc(order, actor.uid);
    if (order.get("status") === "cancelled")
      throw new FinanceError("invalid_state");
    const existing = order.get("invoiceId") as string | undefined;
    if (existing) {
      const prev = await tx.get(col(COLLECTIONS.invoices).doc(existing));
      if (prev.exists && prev.get("status") !== "cancelled")
        throw new FinanceError("already_invoiced");
    }
    const seller = order.get("seller") ?? {};
    const buyer = order.get("buyer") ?? {};
    tx.create(invoiceRef, {
      farmerId: actor.uid,
      ...(order.get("consumerId")
        ? { consumerId: order.get("consumerId") }
        : {}),
      orderId: orderRef.id,
      ...(seller.name ? { sellerName: seller.name } : {}),
      ...(seller.phone ? { sellerPhone: seller.phone } : {}),
      ...(seller.place ? { sellerPlace: seller.place } : {}),
      buyerName: textOf(buyer.name ?? { en: "Buyer" }) || "Buyer",
      ...(buyer.phone ? { buyerPhone: buyer.phone } : {}),
      ...(buyer.place ? { buyerPlace: buyer.place } : {}),
      lines: order.get("items"),
      subtotalLaari: order.get("subtotalLaari"),
      discountLaari: order.get("discountLaari") ?? 0,
      deliveryFeeLaari: order.get("deliveryFeeLaari"),
      totalLaari: order.get("totalLaari"),
      paidLaari: 0,
      refundedLaari: 0,
      currency: CURRENCY,
      status: "draft",
      ...(data.paymentTerms ? { paymentTerms: data.paymentTerms } : {}),
      ...(data.notes ? { notes: data.notes } : {}),
      ...(data.dueAt ? { dueAt: data.dueAt } : {}),
      createdAt: serverNow(),
      updatedAt: serverNow(),
    });
    tx.update(orderRef, { invoiceId: invoiceRef.id, updatedAt: serverNow() });
  });
  return invoiceRef.id;
}

/** Issues a draft: assigns its unique number; lines are fixed from now on. */
export async function issueInvoice(
  actor: FinanceActor,
  invoiceId: string,
): Promise<string> {
  await assertActiveFarmer(actor);
  const ref = col(COLLECTIONS.invoices).doc(invoiceId);
  const counterRef = col(COLLECTIONS.financeCounters).doc(actor.uid);
  let number = "";
  await db().runTransaction(async (tx) => {
    const [invoice, counter] = await Promise.all([
      tx.get(ref),
      tx.get(counterRef),
    ]);
    ownDoc(invoice, actor.uid);
    if (invoice.get("status") !== "draft")
      throw new FinanceError("invalid_state");
    number = nextNumber(tx, counter, "invoice", actor.uid);
    tx.update(ref, {
      number,
      status: "issued",
      issuedAt: serverNow(),
      updatedAt: serverNow(),
    });
  });
  return number;
}

/** Cancels a draft, or an issued invoice that has no money recorded against it. */
export async function cancelInvoice(
  actor: FinanceActor,
  invoiceId: string,
  reason: string,
) {
  await assertActiveFarmer(actor);
  const why = reason.trim();
  if (why.length < 3 || why.length > 500)
    throw new FinanceError("invalid_input");
  const ref = col(COLLECTIONS.invoices).doc(invoiceId);
  await db().runTransaction(async (tx) => {
    const invoice = await tx.get(ref);
    ownDoc(invoice, actor.uid);
    const status = invoice.get("status") as InvoiceState;
    if (!["draft", "issued"].includes(status))
      throw new FinanceError("invalid_state");
    const entries = await tx.get(
      col(COLLECTIONS.payments).where("invoiceId", "==", invoiceId),
    );
    if (
      entries.docs.some((d) => effectiveAmount(d.data() as LedgerEntry) !== 0)
    )
      throw new FinanceError("invalid_state");
    tx.update(ref, {
      status: "cancelled",
      cancelledAt: serverNow(),
      cancelReason: why,
      updatedAt: serverNow(),
    });
  });
}

// ---------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------

type PendingEntry = LedgerEntry & { id?: string };

/**
 * Recomputes the invoice's paid amount and status from its ledger (plus the
 * changes this transaction is about to write) and updates the cache.
 */
function recompute(
  tx: Transaction,
  invoice: DocumentSnapshot,
  ledger: PendingEntry[],
) {
  const total = invoice.get("totalLaari") as number;
  const summary = summarizeLedger(ledger, total);
  const status = deriveInvoiceState(invoice.get("status"), summary, total);
  tx.update(invoice.ref, {
    paidLaari: Math.max(0, summary.netPaidLaari),
    refundedLaari: summary.refundedLaari,
    status,
    updatedAt: serverNow(),
  });
  return summary;
}

async function readLedger(tx: Transaction, invoiceId: string) {
  const snap = await tx.get(
    col(COLLECTIONS.payments).where("invoiceId", "==", invoiceId),
  );
  return snap.docs.map((d) => ({
    id: d.id,
    ref: d.ref,
    ...(d.data() as LedgerEntry),
  }));
}

/** A proof file must be this farmer's own, allowed type and size. */
async function checkProof(
  farmerId: string,
  path?: string,
): Promise<string | undefined> {
  if (!path) return undefined;
  const prefix = storagePaths
    .paymentProof(farmerId, "", "")
    .replace(/\/+$/, "/");
  if (
    !path.startsWith(prefix) ||
    path.includes("..") ||
    !/^payments\/[^/]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]{1,100}$/.test(path)
  )
    throw new FinanceError("proof_invalid");
  const file = getAdminStorage().bucket().file(path);
  const [exists] = await file.exists();
  if (!exists) throw new FinanceError("proof_invalid");
  const [meta] = await file.getMetadata();
  const size = Number(meta.size ?? 0);
  if (
    !(UPLOAD_LIMITS.proofTypes as readonly string[]).includes(
      String(meta.contentType),
    ) ||
    size <= 0 ||
    size > UPLOAD_LIMITS.proofBytes
  )
    throw new FinanceError("proof_invalid");
  return path;
}

async function addEntry(
  actor: FinanceActor,
  invoiceId: string,
  kind: "payment" | "refund",
  input: PaymentInput,
): Promise<{ paymentId: string; receiptId: string; receiptNumber: string }> {
  await assertActiveFarmer(actor);
  const parsed = paymentInputSchema.safeParse(input);
  if (!parsed.success) throw new FinanceError("invalid_input");
  const data = parsed.data;
  if (data.receivedAt.getTime() > Date.now() + 24 * 60 * 60 * 1000)
    throw new FinanceError("invalid_input");
  const proofPath = await checkProof(actor.uid, data.proofPath);

  const invoiceRef = col(COLLECTIONS.invoices).doc(invoiceId);
  const counterRef = col(COLLECTIONS.financeCounters).doc(actor.uid);
  const paymentRef = col(COLLECTIONS.payments).doc();
  const receiptRef = col(COLLECTIONS.receipts).doc();
  let receiptNumber = "";

  await db().runTransaction(async (tx) => {
    const [invoice, counter] = await Promise.all([
      tx.get(invoiceRef),
      tx.get(counterRef),
    ]);
    ownDoc(invoice, actor.uid);
    const status = invoice.get("status") as InvoiceState;
    const ledger = await readLedger(tx, invoiceId);
    const total = invoice.get("totalLaari") as number;
    const before = summarizeLedger(ledger, total);

    if (kind === "payment") {
      if (!["issued", "partially_paid"].includes(status))
        throw new FinanceError("invalid_state");
      if (data.amountLaari > before.outstandingLaari)
        throw new FinanceError("overpayment");
    } else {
      if (!["partially_paid", "paid"].includes(status))
        throw new FinanceError("invalid_state");
      if (data.amountLaari > before.netPaidLaari)
        throw new FinanceError("refund_exceeds_paid");
    }

    // A transfer with evidence awaits an administrator's check; everything
    // else is the seller's own statement.
    const verificationStatus =
      kind === "payment" &&
      (VERIFIABLE_METHODS as readonly string[]).includes(data.method) &&
      (proofPath || data.reference)
        ? "pending_verification"
        : "recorded";
    const entry: LedgerEntry = {
      kind,
      amountLaari: data.amountLaari,
      verificationStatus,
    };

    receiptNumber = nextNumber(tx, counter, "receipt", actor.uid);
    tx.create(paymentRef, {
      invoiceId,
      ...(invoice.get("orderId") ? { orderId: invoice.get("orderId") } : {}),
      farmerId: actor.uid,
      ...(invoice.get("consumerId")
        ? { consumerId: invoice.get("consumerId") }
        : {}),
      kind,
      amountLaari: data.amountLaari,
      effectiveLaari: effectiveAmount(entry),
      currency: CURRENCY,
      method: data.method,
      ...(data.reference ? { reference: data.reference } : {}),
      ...(proofPath ? { proofPath } : {}),
      receivedAt: data.receivedAt,
      recordedBy: actor.uid,
      recordedByRole: "farmer",
      ...(data.notes ? { notes: data.notes } : {}),
      verificationStatus,
      receiptId: receiptRef.id,
      createdAt: serverNow(),
      updatedAt: serverNow(),
    });
    tx.create(receiptRef, {
      number: receiptNumber,
      paymentId: paymentRef.id,
      invoiceId,
      farmerId: actor.uid,
      ...(invoice.get("consumerId")
        ? { consumerId: invoice.get("consumerId") }
        : {}),
      kind,
      amountLaari: data.amountLaari,
      currency: CURRENCY,
      issuedAt: serverNow(),
      createdAt: serverNow(),
    });
    recompute(tx, invoice, [...ledger, entry]);
  });
  return { paymentId: paymentRef.id, receiptId: receiptRef.id, receiptNumber };
}

/** Records money received against an issued invoice (partial payments allowed). */
export function recordPayment(
  actor: FinanceActor,
  invoiceId: string,
  input: PaymentInput,
) {
  return addEntry(actor, invoiceId, "payment", input);
}

/** Records money returned to the buyer. */
export function recordRefund(
  actor: FinanceActor,
  invoiceId: string,
  input: PaymentInput,
) {
  return addEntry(actor, invoiceId, "refund", input);
}

/**
 * Corrects a ledger entry by reversing it: a reversal entry is added and the
 * original is marked reversed (it stays on record). Farmers can reverse their
 * own unverified entries; verified ones need an administrator with
 * "payments.verify" (checked by the caller in admin.ts).
 */
export async function reverseEntry(
  actor: FinanceActor,
  paymentId: string,
  reason: string,
  opts: { asAdmin?: boolean } = {},
): Promise<string> {
  const why = reason.trim();
  if (why.length < 3 || why.length > 500)
    throw new FinanceError("invalid_input");
  if (!opts.asAdmin) await assertActiveFarmer(actor);
  const originalRef = col(COLLECTIONS.payments).doc(paymentId);
  const reversalRef = col(COLLECTIONS.payments).doc();

  await db().runTransaction(async (tx) => {
    const original = await tx.get(originalRef);
    if (!original.exists) throw new FinanceError("not_found");
    if (!opts.asAdmin) ownDoc(original, actor.uid);
    if (original.get("kind") === "reversal" || original.get("reversed"))
      throw new FinanceError("invalid_state");
    if (!opts.asAdmin && original.get("verificationStatus") === "verified")
      throw new FinanceError("forbidden");
    const invoiceId = original.get("invoiceId") as string;
    const invoice = await tx.get(col(COLLECTIONS.invoices).doc(invoiceId));
    const ledger = await readLedger(tx, invoiceId);
    const updated = ledger.map((e) =>
      e.id === paymentId ? { ...e, reversed: true } : e,
    );
    const reversal: LedgerEntry = {
      kind: "reversal",
      amountLaari: original.get("amountLaari"),
      verificationStatus: "recorded",
    };
    tx.create(reversalRef, {
      invoiceId,
      ...(original.get("orderId") ? { orderId: original.get("orderId") } : {}),
      farmerId: original.get("farmerId"),
      ...(original.get("consumerId")
        ? { consumerId: original.get("consumerId") }
        : {}),
      kind: "reversal",
      amountLaari: original.get("amountLaari"),
      effectiveLaari: 0,
      currency: CURRENCY,
      method: original.get("method"),
      receivedAt: new Date(),
      recordedBy: actor.uid,
      recordedByRole: opts.asAdmin ? "admin" : "farmer",
      verificationStatus: "recorded",
      reversesId: paymentId,
      reason: why,
      createdAt: serverNow(),
      updatedAt: serverNow(),
    });
    tx.update(originalRef, {
      reversed: true,
      reversedBy: reversalRef.id,
      effectiveLaari: 0,
      updatedAt: serverNow(),
    });
    recompute(tx, invoice, [...updated, reversal]);
    if (opts.asAdmin)
      addAdminLog(tx, {
        actorId: actor.uid,
        action: "payment.reversal",
        targetType: "payment",
        targetId: paymentId,
        details: { reversalId: reversalRef.id, reason: why },
      });
  });
  return reversalRef.id;
}

/**
 * Administrator verification of a seller-recorded transfer. Only entries
 * awaiting verification, and only with a slip or reference as evidence.
 */
export async function setVerification(
  actor: FinanceActor,
  paymentId: string,
  status: "verified" | "rejected",
  note?: string,
) {
  const ref = col(COLLECTIONS.payments).doc(paymentId);
  await db().runTransaction(async (tx) => {
    const payment = await tx.get(ref);
    if (!payment.exists) throw new FinanceError("not_found");
    if (
      payment.get("verificationStatus") !== "pending_verification" ||
      payment.get("reversed")
    )
      throw new FinanceError("invalid_state");
    if (
      status === "verified" &&
      !payment.get("proofPath") &&
      !payment.get("reference")
    )
      throw new FinanceError("invalid_state");
    const invoiceId = payment.get("invoiceId") as string;
    const invoice = await tx.get(col(COLLECTIONS.invoices).doc(invoiceId));
    const ledger = await readLedger(tx, invoiceId);
    const updated = ledger.map((e) =>
      e.id === paymentId ? { ...e, verificationStatus: status } : e,
    );
    const changed = updated.find((e) => e.id === paymentId)!;
    tx.update(ref, {
      verificationStatus: status,
      verifiedBy: actor.uid,
      verifiedAt: serverNow(),
      effectiveLaari: effectiveAmount(changed),
      ...(note?.trim() ? { verificationNote: note.trim().slice(0, 500) } : {}),
      updatedAt: serverNow(),
    });
    recompute(tx, invoice, updated);
    addAdminLog(tx, {
      actorId: actor.uid,
      action: "payment.verification",
      targetType: "payment",
      targetId: paymentId,
      details: { status, invoiceId },
    });
  });
}

export type { DocumentReference };
