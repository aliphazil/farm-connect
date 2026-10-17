import { z } from "zod";
import {
  atollCodeSchema,
  idSchema,
  localizedTextSchema,
  locationSchema,
  mapLocationSchema,
  mvPhoneSchema,
  storagePathSchema,
  timestampsSchema,
} from "./common";

/** Where a farmer is willing to deliver. Omit `islandId` for the whole atoll. */
export const deliveryDestinationSchema = z.object({
  atollCode: atollCodeSchema,
  islandId: idSchema.optional(),
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

export const FARMER_APPROVAL_STATUSES = [
  "pending",
  "approved",
  "rejected",
] as const;
export type FarmerApprovalStatus = (typeof FARMER_APPROVAL_STATUSES)[number];

/**
 * Farm profile: `farmerProfiles/{uid}`. Publicly readable only when
 * `approvalStatus == "approved"` and `visible == true`.
 * Server-controlled: approvalStatus, verified, visible.
 */
export const farmerProfileSchema = z
  .object({
    uid: idSchema,
    farmName: localizedTextSchema(80),
    bio: localizedTextSchema(1000).optional(),
    location: locationSchema,
    contact: farmerContactSchema,
    deliveryDestinations: z.array(deliveryDestinationSchema).max(50),
    logoPath: storagePathSchema.optional(),
    /** Free-text directions, e.g. "Behind the school, Thoddoo". */
    address: z.string().trim().max(200).optional(),
    mapLocation: mapLocationSchema.optional(),
    /** Buyers may collect from the farm. */
    pickupAvailable: z.boolean(),
    approvalStatus: z.enum(FARMER_APPROVAL_STATUSES),
    /** Set by admins after checking the farm in person or by documents. */
    verified: z.boolean(),
    /** False while the owner is blocked. */
    visible: z.boolean(),
  })
  .extend(timestampsSchema.shape);
export type FarmerProfile = z.infer<typeof farmerProfileSchema>;

/** Fields an owner may change (enforced by Security Rules too). */
export const FARMER_SELF_EDITABLE_FIELDS = [
  "farmName",
  "bio",
  "location",
  "contact",
  "deliveryDestinations",
  "logoPath",
  "address",
  "mapLocation",
  "pickupAvailable",
] as const;

export const farmerProfileUpdateSchema = farmerProfileSchema
  .pick({
    farmName: true,
    bio: true,
    location: true,
    contact: true,
    deliveryDestinations: true,
    logoPath: true,
    address: true,
    mapLocation: true,
    pickupAvailable: true,
  })
  .partial();
export type FarmerProfileUpdate = z.infer<typeof farmerProfileUpdateSchema>;

/** A farm is shown publicly only when both flags allow it. */
export function isFarmPublic(
  p: Pick<FarmerProfile, "approvalStatus" | "visible">,
): boolean {
  return p.approvalStatus === "approved" && p.visible;
}
