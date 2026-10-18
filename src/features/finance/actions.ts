"use server";

import type { InvoiceInput, OrderInput, PaymentInput } from "@shared/schemas";
import { AuthorizationError, assertRole } from "@/lib/auth/session";
import * as finance from "@/services/server/finance";

/**
 * Farmer Server Actions for transactions, invoices and the payment ledger.
 * Each verifies the session (farmer role); the service checks ownership,
 * account status, amounts and allowed state changes.
 */

export type FinanceActionResult =
  | { ok: true; id?: string; number?: string }
  | { ok: false; error: finance.FinanceErrorCode | "unauthorized" | "failed" };

async function run(
  work: (actor: finance.FinanceActor) => Promise<unknown>,
): Promise<FinanceActionResult> {
  try {
    const user = await assertRole(["farmer"]);
    const value = await work({ uid: user.uid, role: user.role });
    if (typeof value === "string")
      return { ok: true, id: value, number: value };
    if (value && typeof value === "object" && "paymentId" in value)
      return { ok: true, id: (value as { paymentId: string }).paymentId };
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthorizationError)
      return { ok: false, error: "unauthorized" };
    if (error instanceof finance.FinanceError)
      return { ok: false, error: error.code };
    console.error("Finance action failed", error);
    return { ok: false, error: "failed" };
  }
}

export async function createOrderAction(input: OrderInput) {
  return run((a) => finance.createOrder(a, input));
}

export async function setOrderStatusAction(
  orderId: string,
  status: "delivered" | "cancelled",
) {
  return run((a) => finance.setOrderStatus(a, orderId, status));
}

export async function createInvoiceAction(input: InvoiceInput) {
  return run((a) => finance.createInvoice(a, input));
}

export async function issueInvoiceAction(invoiceId: string) {
  return run((a) => finance.issueInvoice(a, invoiceId));
}

export async function cancelInvoiceAction(invoiceId: string, reason: string) {
  return run((a) => finance.cancelInvoice(a, invoiceId, reason));
}

export async function recordPaymentAction(
  invoiceId: string,
  input: PaymentInput,
) {
  return run((a) => finance.recordPayment(a, invoiceId, input));
}

export async function recordRefundAction(
  invoiceId: string,
  input: PaymentInput,
) {
  return run((a) => finance.recordRefund(a, invoiceId, input));
}

export async function reverseEntryAction(paymentId: string, reason: string) {
  return run((a) => finance.reverseEntry(a, paymentId, reason));
}
