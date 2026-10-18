import { describe, expect, it } from "vitest";
import {
  TotalsError,
  computeTotals,
  deriveInvoiceState,
  effectiveAmount,
  lineTotal,
  normalizeQuantity,
  summarizeLedger,
  type LedgerEntry,
} from "./ledger";

describe("line totals and rounding", () => {
  it("multiplies in whole laari", () => {
    expect(lineTotal(2, 2500)).toBe(5000);
    expect(lineTotal(1.5, 2550)).toBe(3825);
  });

  it("rounds half up without floating-point drift", () => {
    expect(lineTotal(1.005, 100)).toBe(101); // 100.5 → 101
    expect(lineTotal(0.333, 100)).toBe(33); // 33.3 → 33
    expect(lineTotal(0.335, 100)).toBe(34); // 33.5 → 34
    expect(lineTotal(2.675, 1000)).toBe(2675);
    expect(lineTotal(0.1, 3)).toBe(0); // 0.3 laari → 0
    expect(lineTotal(0.25, 3)).toBe(1); // 0.75 → 1
  });

  it("keeps at most three quantity decimals", () => {
    expect(normalizeQuantity(1.23456)).toBe(1.235);
    expect(normalizeQuantity(0.1 + 0.2)).toBe(0.3);
  });
});

describe("totals", () => {
  it("adds lines, subtracts the discount and adds delivery", () => {
    const t = computeTotals(
      [
        { quantity: 2, unitPriceLaari: 2500 },
        { quantity: 1.5, unitPriceLaari: 1999 },
      ],
      500,
      5000,
    );
    expect(t.lineTotals).toEqual([5000, 2999]); // 2998.5 → 2999
    expect(t).toMatchObject({
      subtotalLaari: 7999,
      discountLaari: 500,
      deliveryFeeLaari: 5000,
      totalLaari: 12499,
    });
  });

  it("rejects discounts above the subtotal and invalid amounts", () => {
    expect(() =>
      computeTotals([{ quantity: 1, unitPriceLaari: 100 }], 101),
    ).toThrow(TotalsError);
    expect(() =>
      computeTotals([{ quantity: 1, unitPriceLaari: 10.5 }]),
    ).toThrow(TotalsError);
    expect(() => computeTotals([{ quantity: 0, unitPriceLaari: 100 }])).toThrow(
      TotalsError,
    );
    expect(() =>
      computeTotals([{ quantity: 1, unitPriceLaari: 100 }], 0, -1),
    ).toThrow(TotalsError);
  });
});

const pay = (
  amount: number,
  extra: Partial<LedgerEntry> = {},
): LedgerEntry => ({
  kind: "payment",
  amountLaari: amount,
  verificationStatus: "recorded",
  ...extra,
});

describe("ledger", () => {
  it("supports partial and multiple payments", () => {
    const s = summarizeLedger(
      [pay(3000), pay(2000, { verificationStatus: "pending_verification" })],
      10000,
    );
    expect(s).toMatchObject({
      receivedLaari: 5000,
      netPaidLaari: 5000,
      pendingLaari: 2000,
      outstandingLaari: 5000,
    });
    expect(deriveInvoiceState("issued", s, 10000)).toBe("partially_paid");
  });

  it("ignores rejected and reversed entries, and reversal entries themselves", () => {
    const entries: LedgerEntry[] = [
      pay(5000, { verificationStatus: "verified" }),
      pay(5000, { verificationStatus: "rejected" }),
      pay(4000, { reversed: true }),
      { kind: "reversal", amountLaari: 4000, verificationStatus: "recorded" },
    ];
    expect(entries.map(effectiveAmount)).toEqual([5000, 0, 0, 0]);
    const s = summarizeLedger(entries, 5000);
    expect(s).toMatchObject({
      netPaidLaari: 5000,
      verifiedLaari: 5000,
      outstandingLaari: 0,
    });
    expect(deriveInvoiceState("partially_paid", s, 5000)).toBe("paid");
  });

  it("refunds reduce the amount paid; a full refund marks the invoice refunded", () => {
    const partial = summarizeLedger(
      [
        pay(6000),
        { kind: "refund", amountLaari: 1000, verificationStatus: "recorded" },
      ],
      6000,
    );
    expect(partial).toMatchObject({
      refundedLaari: 1000,
      netPaidLaari: 5000,
      outstandingLaari: 1000,
    });
    expect(deriveInvoiceState("paid", partial, 6000)).toBe("partially_paid");
    const full = summarizeLedger(
      [
        pay(6000),
        { kind: "refund", amountLaari: 6000, verificationStatus: "recorded" },
      ],
      6000,
    );
    expect(deriveInvoiceState("paid", full, 6000)).toBe("refunded");
  });

  it("keeps draft and cancelled states; unpaid is 'issued'", () => {
    const none = summarizeLedger([], 1000);
    expect(deriveInvoiceState("draft", none, 1000)).toBe("draft");
    expect(deriveInvoiceState("cancelled", none, 1000)).toBe("cancelled");
    expect(deriveInvoiceState("partially_paid", none, 1000)).toBe("issued");
  });
});
