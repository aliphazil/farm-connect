import { z } from "zod";
import {
  idSchema,
  laariSchema,
  localizedTextSchema,
  mvPhoneSchema,
  timestampsSchema,
} from "./common";
import { orderItemSchema } from "./order";

/**
 * draft: being prepared (no number yet). issued: unpaid. partially_paid,
 * paid, refunded: derived from the payment ledger. cancelled: withdrawn
 * (only before any money is recorded). Older records used "void".
 */
export const INVOICE_STATUSES = [
  "draft",
  "issued",
  "partially_paid",
  "paid",
  "cancelled",
  "refunded",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const invoiceLineSchema = orderItemSchema;
export type InvoiceLine = z.infer<typeof invoiceLineSchema>;

/**
 * `invoices/{id}`. Numbers, totals, amounts paid and status are computed by
 * server code from the order and the payment ledger, never from the client.
 * Visible to the farmer, the linked buyer and admins (admin views are logged).
 * No tax is calculated: tax fields need legal validation before they're added.
 */
export const invoiceSchema = z
  .object({
    id: idSchema,
    /** Globally unique, e.g. "INV-ABC123-0001". Assigned when issued. */
    number: z.string().min(1).max(40).optional(),
    farmerId: idSchema,
    consumerId: idSchema.optional(),
    orderId: idSchema.optional(),
    sellerName: localizedTextSchema(120).optional(),
    sellerPhone: mvPhoneSchema.optional(),
    sellerPlace: z.string().max(120).optional(),
    buyerName: z.string().trim().min(1).max(120),
    buyerPhone: mvPhoneSchema.optional(),
    buyerPlace: z.string().max(120).optional(),
    lines: z.array(invoiceLineSchema).min(1).max(100),
    subtotalLaari: laariSchema,
    discountLaari: laariSchema.default(0),
    deliveryFeeLaari: laariSchema,
    totalLaari: laariSchema,
    /** Cache of the ledger (net paid); recomputed with every ledger change. */
    paidLaari: laariSchema,
    refundedLaari: laariSchema.default(0),
    currency: z.literal("MVR").default("MVR"),
    status: z.preprocess(
      (v) => (v === "void" ? "cancelled" : v),
      z.enum(INVOICE_STATUSES),
    ),
    paymentTerms: z.string().max(500).optional(),
    notes: z.string().max(1000).optional(),
    issuedAt: z.date().optional(),
    dueAt: z.date().optional(),
    cancelledAt: z.date().optional(),
    cancelReason: z.string().max(500).optional(),
  })
  .extend(timestampsSchema.shape);
export type Invoice = z.infer<typeof invoiceSchema>;

export const invoiceInputSchema = z.object({
  orderId: idSchema,
  dueAt: z.date().optional(),
  paymentTerms: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
});
export type InvoiceInput = z.infer<typeof invoiceInputSchema>;
