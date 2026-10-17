import { z } from "zod";
import { PRODUCT_UNITS } from "../constants/catalog";
import {
  idSchema,
  laariSchema,
  locationSchema,
  timestampsSchema,
} from "./common";

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const orderItemSchema = z.object({
  productId: idSchema,
  title: z.string().trim().min(1).max(100),
  quantity: z.number().positive().max(1_000_000),
  unit: z.enum(PRODUCT_UNITS),
  unitPriceLaari: laariSchema,
  /** quantity × unit price, rounded to whole laari — computed server-side. */
  totalLaari: laariSchema,
});
export type OrderItem = z.infer<typeof orderItemSchema>;

/**
 * `orders/{id}` — an agreed sale between a consumer and a farmer (usually
 * from an accepted enquiry). There is no online payment: totals are records
 * of what was agreed. Server-written; visible to both parties and admins.
 */
export const orderSchema = z
  .object({
    id: idSchema,
    farmerId: idSchema,
    consumerId: idSchema,
    enquiryId: idSchema.optional(),
    items: z.array(orderItemSchema).min(1).max(100),
    subtotalLaari: laariSchema,
    deliveryFeeLaari: laariSchema,
    totalLaari: laariSchema,
    deliverTo: locationSchema,
    status: z.enum(ORDER_STATUSES),
    notes: z.string().max(1000).optional(),
  })
  .extend(timestampsSchema.shape);
export type Order = z.infer<typeof orderSchema>;
