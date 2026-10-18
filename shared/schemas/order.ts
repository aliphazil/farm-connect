import { z } from "zod";
import { PRODUCT_UNITS } from "../constants/catalog";
import {
  idSchema,
  laariSchema,
  localizedTextSchema,
  locationSchema,
  mvPhoneSchema,
  timestampsSchema,
} from "./common";

/** pending (legacy), confirmed = agreed, delivered, cancelled. */
export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Older records stored the item title as a plain string. */
const titleSnapshot = z.preprocess(
  (v) => (typeof v === "string" ? { en: v } : v),
  localizedTextSchema(100),
);

/**
 * One agreed line: a snapshot of the product's name, unit and agreed price at
 * the time of the agreement, so later listing edits don't change history.
 */
export const orderItemSchema = z.object({
  productId: idSchema.optional(),
  title: titleSnapshot,
  quantity: z.number().positive().max(1_000_000),
  unit: z.enum(PRODUCT_UNITS),
  unitPriceLaari: laariSchema,
  /** quantity × unit price, rounded half-up to whole laari (shared/ledger.ts). */
  totalLaari: laariSchema,
});
export type OrderItem = z.infer<typeof orderItemSchema>;

/** Who was selling and buying, as recorded at the time. */
export const partySnapshotSchema = z.object({
  name: localizedTextSchema(120),
  phone: mvPhoneSchema.optional(),
  /** e.g. "AA. Thoddoo" */
  place: z.string().max(120).optional(),
});
export type PartySnapshot = z.infer<typeof partySnapshotSchema>;

/**
 * `orders/{id}` — an agreed transaction between a farmer and a buyer (from an
 * accepted enquiry, or with a buyer who isn't on the platform). No online
 * payment: totals record what was agreed. Server-written; visible to both
 * parties and admins.
 */
export const orderSchema = z
  .object({
    id: idSchema,
    farmerId: idSchema,
    /** Linked buyer account, when the buyer is on the platform. */
    consumerId: idSchema.optional(),
    enquiryId: idSchema.optional(),
    seller: partySnapshotSchema.optional(),
    buyer: partySnapshotSchema.optional(),
    items: z.array(orderItemSchema).min(1).max(100),
    subtotalLaari: laariSchema,
    discountLaari: laariSchema.default(0),
    deliveryFeeLaari: laariSchema,
    totalLaari: laariSchema,
    currency: z.literal("MVR").default("MVR"),
    deliverTo: locationSchema.optional(),
    status: z.enum(ORDER_STATUSES),
    notes: z.string().max(1000).optional(),
    agreedAt: z.date().optional(),
    deliveredAt: z.date().optional(),
    cancelledAt: z.date().optional(),
    invoiceId: idSchema.optional(),
  })
  .extend(timestampsSchema.shape);
export type Order = z.infer<typeof orderSchema>;

export const orderInputSchema = z.object({
  enquiryId: idSchema.optional(),
  /** Off-platform buyer (used when there's no enquiry). */
  buyerName: z.string().trim().min(1).max(120).optional(),
  buyerPhone: mvPhoneSchema.optional(),
  items: z
    .array(
      z.object({
        productId: idSchema.optional(),
        title: z.string().trim().max(100).optional(),
        quantity: z.number().positive().max(1_000_000),
        unit: z.enum(PRODUCT_UNITS),
        unitPriceLaari: laariSchema,
      }),
    )
    .min(1)
    .max(50),
  discountLaari: laariSchema.default(0),
  deliveryFeeLaari: laariSchema.default(0),
  notes: z.string().trim().max(1000).optional(),
});
export type OrderInput = z.input<typeof orderInputSchema>;
