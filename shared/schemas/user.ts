import { z } from "zod";
import { LOCALES } from "../constants/locales";
import { ACCOUNT_STATUSES, ROLES } from "../constants/roles";
import {
  idSchema,
  locationSchema,
  mvPhoneSchema,
  timestampsSchema,
} from "./common";

/**
 * Private account record: `users/{uid}`. Readable by the owner and admins.
 * `role` and `status` mirror the Auth custom claims and are written only by
 * server code.
 */
export const userProfileSchema = z
  .object({
    uid: idSchema,
    role: z.enum(ROLES),
    status: z.enum(ACCOUNT_STATUSES),
    displayName: z.string().trim().min(1).max(80),
    email: z.email().optional(),
    phone: mvPhoneSchema.optional(),
    preferredLocale: z.enum(LOCALES),
    location: locationSchema.optional(),
    blockedReason: z.string().max(500).optional(),
  })
  .extend(timestampsSchema.shape);
export type UserProfile = z.infer<typeof userProfileSchema>;

/** Fields a user may change on their own profile (validated server-side). */
export const userProfileUpdateSchema = userProfileSchema
  .pick({
    displayName: true,
    phone: true,
    preferredLocale: true,
    location: true,
  })
  .partial();
export type UserProfileUpdate = z.infer<typeof userProfileUpdateSchema>;
