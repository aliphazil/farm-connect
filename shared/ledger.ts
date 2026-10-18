/**
 * Money arithmetic for transactions, invoices and the payment ledger.
 * Amounts are integer laari (1 MVR = 100 laari); quantities may have up to
 * three decimals (e.g. 1.25 kg). Everything here is pure so web, server and
 * a future mobile app compute identical totals, and so it can be unit-tested.
 */

export const CURRENCY = "MVR" as const;
export const MAX_QUANTITY_DECIMALS = 3;

/** Quantity rounded to at most three decimals. */
export function normalizeQuantity(q: number): number {
  return (
    Math.round(q * 10 ** MAX_QUANTITY_DECIMALS) / 10 ** MAX_QUANTITY_DECIMALS
  );
}

/**
 * quantity × unit price, rounded half-up to whole laari. Computed in integer
 * thousandths so floating point can't shift the result (1.005 kg × 100 = 101,
 * not 100.49999…).
 */
export function lineTotal(quantity: number, unitPriceLaari: number): number {
  const milli = Math.round(quantity * 1000);
  return Math.floor((milli * unitPriceLaari + 500) / 1000);
}

export type LineInput = { quantity: number; unitPriceLaari: number };

export type Totals = {
  subtotalLaari: number;
  discountLaari: number;
  deliveryFeeLaari: number;
  totalLaari: number;
};

export class TotalsError extends Error {
  constructor(
    public readonly code: "discount_exceeds_subtotal" | "invalid_amount",
  ) {
    super(code);
    this.name = "TotalsError";
  }
}

const isLaari = (n: number) =>
  Number.isInteger(n) && n >= 0 && n <= 10_000_000_000;

/** Subtotal of the lines, minus discount, plus delivery fee. */
export function computeTotals(
  lines: LineInput[],
  discountLaari = 0,
  deliveryFeeLaari = 0,
): Totals & { lineTotals: number[] } {
  if (!isLaari(discountLaari) || !isLaari(deliveryFeeLaari))
    throw new TotalsError("invalid_amount");
  const lineTotals = lines.map((l) => {
    if (!isLaari(l.unitPriceLaari) || !(l.quantity > 0))
      throw new TotalsError("invalid_amount");
    return lineTotal(l.quantity, l.unitPriceLaari);
  });
  const subtotalLaari = lineTotals.reduce((a, b) => a + b, 0);
  if (discountLaari > subtotalLaari)
    throw new TotalsError("discount_exceeds_subtotal");
  return {
    lineTotals,
    subtotalLaari,
    discountLaari,
    deliveryFeeLaari,
    totalLaari: subtotalLaari - discountLaari + deliveryFeeLaari,
  };
}

export type LedgerKind = "payment" | "refund" | "reversal";
export type LedgerStatus =
  "recorded" | "pending_verification" | "verified" | "rejected";

export type LedgerEntry = {
  kind: LedgerKind;
  amountLaari: number;
  verificationStatus: LedgerStatus;
  /** Set on an entry that a later reversal cancelled. */
  reversed?: boolean;
};

/**
 * How much an entry changes the amount paid: payments add, refunds subtract,
 * and rejected, reversed and reversal entries count for nothing (a reversal
 * works by cancelling the entry it points to).
 */
export function effectiveAmount(e: LedgerEntry): number {
  if (
    e.kind === "reversal" ||
    e.reversed ||
    e.verificationStatus === "rejected"
  )
    return 0;
  return e.kind === "refund" ? -e.amountLaari : e.amountLaari;
}

export type LedgerSummary = {
  /** Valid payments received (before refunds). */
  receivedLaari: number;
  refundedLaari: number;
  /** received − refunded. */
  netPaidLaari: number;
  /** Part of the valid payments an administrator verified. */
  verifiedLaari: number;
  /** Part of the valid payments awaiting verification. */
  pendingLaari: number;
  outstandingLaari: number;
};

export function summarizeLedger(
  entries: LedgerEntry[],
  totalLaari: number,
): LedgerSummary {
  let received = 0;
  let refunded = 0;
  let verified = 0;
  let pending = 0;
  for (const e of entries) {
    const amount = effectiveAmount(e);
    if (amount > 0) {
      received += amount;
      if (e.verificationStatus === "verified") verified += amount;
      if (e.verificationStatus === "pending_verification") pending += amount;
    } else refunded -= amount;
  }
  const net = received - refunded;
  return {
    receivedLaari: received,
    refundedLaari: refunded,
    netPaidLaari: net,
    verifiedLaari: verified,
    pendingLaari: pending,
    outstandingLaari: Math.max(0, totalLaari - net),
  };
}

export type InvoiceState =
  "draft" | "issued" | "partially_paid" | "paid" | "cancelled" | "refunded";

/**
 * The invoice's status from its ledger. Drafts and cancelled invoices keep
 * their status; otherwise: fully refunded → refunded, paid in full → paid,
 * something paid → partially_paid, nothing → issued (unpaid).
 */
export function deriveInvoiceState(
  current: InvoiceState,
  summary: LedgerSummary,
  totalLaari: number,
): InvoiceState {
  if (current === "draft" || current === "cancelled") return current;
  if (summary.refundedLaari > 0 && summary.netPaidLaari <= 0) return "refunded";
  if (summary.netPaidLaari >= totalLaari && totalLaari > 0) return "paid";
  if (summary.netPaidLaari > 0) return "partially_paid";
  return "issued";
}
