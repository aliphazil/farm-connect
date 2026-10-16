import { z } from "zod";
import { idSchema, locationSchema, timestampsSchema } from "./common";

export const ENQUIRY_STATUSES = [
  "new",
  "accepted",
  "declined",
  "completed",
  "cancelled",
] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

/**
 * A buyer's request to a farmer about a listing: `enquiries/{id}`.
 * No online payment — the parties arrange delivery and payment directly.
 */
export const enquirySchema = z
  .object({
    id: idSchema,
    listingId: idSchema,
    farmerId: idSchema,
    buyerId: idSchema,
    quantity: z.number().positive().max(1_000_000),
    message: z.string().trim().max(1000).optional(),
    deliverTo: locationSchema,
    status: z.enum(ENQUIRY_STATUSES),
  })
  .extend(timestampsSchema.shape);
export type Enquiry = z.infer<typeof enquirySchema>;

export const enquiryInputSchema = enquirySchema.pick({
  listingId: true,
  quantity: true,
  message: true,
  deliverTo: true,
});
export type EnquiryInput = z.infer<typeof enquiryInputSchema>;
