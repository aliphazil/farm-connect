import { z } from "zod";
import {
  idSchema,
  localizedTextSchema,
  locationSchema,
  mvPhoneSchema,
  storagePathSchema,
  timestampsSchema,
} from "./common";

/** Where a farmer is willing to deliver. Omit `islandId` for the whole atoll. */
export const deliveryDestinationSchema = z.object({
  atollCode: locationSchema.shape.atollCode,
  islandId: z.string().min(1).max(128).optional(),
});
export type DeliveryDestination = z.infer<typeof deliveryDestinationSchema>;

/**
 * Public by design: buyers contact farmers directly. Security Rules can't hide
 * individual fields, so anything private must live in `users/{uid}` instead.
 */
export const farmerContactSchema = z.object({
  phone: mvPhoneSchema,
  whatsapp: mvPhoneSchema.optional(),
  viber: mvPhoneSchema.optional(),
});

/** Public farm profile: `farmers/{uid}` (doc id = owner's uid). */
export const farmerProfileSchema = z
  .object({
    uid: idSchema,
    farmName: localizedTextSchema(80),
    bio: localizedTextSchema(1000).optional(),
    location: locationSchema,
    contact: farmerContactSchema,
    deliveryDestinations: z.array(deliveryDestinationSchema).max(50),
    logoPath: storagePathSchema.optional(),
    /** Set by admins after checking the farm is real. */
    verified: z.boolean(),
    /** Hidden from the marketplace while the owner is blocked. */
    visible: z.boolean(),
  })
  .extend(timestampsSchema.shape);
export type FarmerProfile = z.infer<typeof farmerProfileSchema>;

export const farmerProfileInputSchema = farmerProfileSchema.pick({
  farmName: true,
  bio: true,
  location: true,
  contact: true,
  deliveryDestinations: true,
});
export type FarmerProfileInput = z.infer<typeof farmerProfileInputSchema>;
