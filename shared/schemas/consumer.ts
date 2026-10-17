import { z } from "zod";
import { idSchema, locationSchema, timestampsSchema } from "./common";

/**
 * Private buyer preferences: `consumerProfiles/{uid}`. Owner and admins only.
 * Created by the server at registration.
 */
export const consumerProfileSchema = z
  .object({
    uid: idSchema,
    defaultDeliveryLocation: locationSchema.optional(),
    marketingOptIn: z.boolean(),
  })
  .extend(timestampsSchema.shape);
export type ConsumerProfile = z.infer<typeof consumerProfileSchema>;

export const CONSUMER_SELF_EDITABLE_FIELDS = [
  "defaultDeliveryLocation",
  "marketingOptIn",
] as const;

export const consumerProfileUpdateSchema = consumerProfileSchema
  .pick({ defaultDeliveryLocation: true, marketingOptIn: true })
  .partial();
export type ConsumerProfileUpdate = z.infer<typeof consumerProfileUpdateSchema>;
