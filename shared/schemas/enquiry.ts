import { z } from "zod";
import {
  idSchema,
  locationSchema,
  mvPhoneSchema,
  timestampsSchema,
} from "./common";

export const ENQUIRY_STATUSES = [
  "new",
  "accepted",
  "declined",
  "completed",
  "cancelled",
] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

/**
 * Allowed status changes and who may make them. Mirrored in Security Rules.
 * Farmers respond; consumers may cancel while the enquiry is still open.
 */
export const ENQUIRY_TRANSITIONS = {
  farmer: { new: ["accepted", "declined"], accepted: ["completed"] },
  consumer: { new: ["cancelled"], accepted: ["cancelled"] },
} as const;

/**
 * A consumer's request to a farmer about a product: `enquiries/{id}`.
 * No online payment — the parties arrange delivery and payment directly.
 */
export const enquirySchema = z
  .object({
    id: idSchema,
    productId: idSchema,
    farmerId: idSchema,
    consumerId: idSchema,
    quantity: z.number().positive().max(1_000_000),
    message: z.string().trim().max(1000).optional(),
    /** Contact details the consumer chose to share with the farmer. */
    consumerName: z.string().trim().min(1).max(80).optional(),
    consumerPhone: mvPhoneSchema.optional(),
    deliverTo: locationSchema,
    status: z.enum(ENQUIRY_STATUSES),
  })
  .extend(timestampsSchema.shape);
export type Enquiry = z.infer<typeof enquirySchema>;

export const enquiryInputSchema = enquirySchema.pick({
  productId: true,
  quantity: true,
  message: true,
  consumerName: true,
  consumerPhone: true,
  deliverTo: true,
});
export type EnquiryInput = z.infer<typeof enquiryInputSchema>;

export const FAVOURITE_TARGETS = ["product", "farmer"] as const;
export type FavouriteTarget = (typeof FAVOURITE_TARGETS)[number];

/**
 * `favourites/{userId}_{targetType}_{targetId}` — a saved product or farm.
 * Private to the owner; the deterministic id prevents duplicates.
 */
export const favouriteSchema = z.object({
  id: idSchema,
  userId: idSchema,
  targetType: z.enum(FAVOURITE_TARGETS),
  targetId: idSchema,
  createdAt: z.date(),
});
export type Favourite = z.infer<typeof favouriteSchema>;
