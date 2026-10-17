import { z } from "zod";
import { ACCOUNT_RESTRICTIONS } from "../constants/admin";
import { LOCALES } from "../constants/locales";
import {
  ACCOUNT_STATUSES,
  ROLES,
  SELF_SERVICE_ROLES,
} from "../constants/roles";
import {
  idSchema,
  localizedTextSchema,
  locationSchema,
  mvPhoneSchema,
  timestampsSchema,
} from "./common";

/**
 * Private account record: `users/{uid}`. Readable by the owner and admins.
 * Created by the server at registration. `role` and `status` mirror the Auth
 * custom claims and are written only by server code.
 */
export const userSchema = z
  .object({
    uid: idSchema,
    role: z.enum(ROLES),
    status: z.enum(ACCOUNT_STATUSES),
    displayName: z.string().trim().min(1).max(80),
    email: z.email().optional(),
    phone: mvPhoneSchema.optional(),
    preferredLocale: z.enum(LOCALES),
    location: locationSchema.optional(),
    /** Reason for the current suspension or block (server-written). */
    blockedReason: z.string().max(500).optional(),
    /** End of the current suspension (status "suspended"). */
    suspendedUntil: z.date().optional(),
    /** Features switched off by an admin (enforced in Security Rules). */
    restrictions: z.array(z.enum(ACCOUNT_RESTRICTIONS)).max(10).optional(),
    /** Set by the server when the user accepts the terms at registration. */
    termsAcceptedAt: z.date().optional(),
    termsVersion: z.string().max(40).optional(),
  })
  .extend(timestampsSchema.shape);
export type UserAccount = z.infer<typeof userSchema>;

/** Fields an owner may change on `users/{uid}` (enforced by Security Rules too). */
export const USER_SELF_EDITABLE_FIELDS = [
  "displayName",
  "phone",
  "preferredLocale",
  "location",
] as const;

export const userSelfUpdateSchema = userSchema
  .pick({
    displayName: true,
    phone: true,
    preferredLocale: true,
    location: true,
  })
  .partial();
export type UserSelfUpdate = z.infer<typeof userSelfUpdateSchema>;

/**
 * Profile details submitted after creating a Firebase Auth account.
 * The role can only be one of SELF_SERVICE_ROLES — `admin` fails validation.
 */
const registrationBase = z.object({
  displayName: z.string().trim().min(1).max(80),
  preferredLocale: z.enum(LOCALES),
  acceptTerms: z.literal(true),
});

export const farmerRegistrationSchema = registrationBase.extend({
  role: z.literal(SELF_SERVICE_ROLES[1]),
  phone: mvPhoneSchema,
  whatsapp: mvPhoneSchema.optional(),
  farmName: localizedTextSchema(80),
  bio: localizedTextSchema(1000).optional(),
  location: locationSchema,
  address: z.string().trim().max(200).optional(),
});

export const consumerRegistrationSchema = registrationBase.extend({
  role: z.literal(SELF_SERVICE_ROLES[0]),
  phone: mvPhoneSchema.optional(),
  location: locationSchema.optional(),
});

export const registrationSchema = z.discriminatedUnion("role", [
  consumerRegistrationSchema,
  farmerRegistrationSchema,
]);
export type RegistrationInput = z.input<typeof registrationSchema>;
export type Registration = z.output<typeof registrationSchema>;
