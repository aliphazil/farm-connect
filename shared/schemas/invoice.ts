import { z } from "zod";
import { PRODUCT_UNITS } from "../constants/catalog";
import {
  idSchema,
  laariSchema,
  mvPhoneSchema,
  timestampsSchema,
} from "./common";

export const INVOICE_STATUSES = [
  "draft",
  "issued",
  "partially_paid",
  "paid",
  "void",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const invoiceLineSchema = z.object({
  description: z.string().trim().min(1).max(200),
  quantity: z.number().positive().max(1_000_000),
  unit: z.enum(PRODUCT_UNITS),
  unitPriceLaari: laariSchema,
  /** quantity × unitPrice, rounded to whole laari — computed server-side. */
  totalLaari: laariSchema,
});
export type InvoiceLine = z.infer<typeof invoiceLineSchema>;

/**
 * `invoices/{id}`. Numbers, totals and status are computed by server code,
 * never trusted from the client.
 */
export const invoiceSchema = z
  .object({
    id: idSchema,
    /** Sequential per farmer, e.g. "FC-0001". */
    number: z.string().min(1).max(32),
    farmerId: idSchema,
    buyerId: idSchema.optional(),
    enquiryId: idSchema.optional(),
    buyerName: z.string().trim().min(1).max(120),
    buyerPhone: mvPhoneSchema.optional(),
    lines: z.array(invoiceLineSchema).min(1).max(100),
    subtotalLaari: laariSchema,
    deliveryFeeLaari: laariSchema,
    totalLaari: laariSchema,
    paidLaari: laariSchema,
    status: z.enum(INVOICE_STATUSES),
    notes: z.string().max(1000).optional(),
    issuedAt: z.date().optional(),
    dueAt: z.date().optional(),
  })
  .extend(timestampsSchema.shape);
export type Invoice = z.infer<typeof invoiceSchema>;

export const invoiceInputSchema = z.object({
  buyerId: idSchema.optional(),
  enquiryId: idSchema.optional(),
  buyerName: invoiceSchema.shape.buyerName,
  buyerPhone: mvPhoneSchema.optional(),
  lines: z
    .array(invoiceLineSchema.omit({ totalLaari: true }))
    .min(1)
    .max(100),
  deliveryFeeLaari: laariSchema,
  notes: invoiceSchema.shape.notes,
  dueAt: z.date().optional(),
});
export type InvoiceInput = z.infer<typeof invoiceInputSchema>;
