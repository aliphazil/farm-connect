import { z } from "zod";
import {
  idSchema,
  localizedTextSchema,
  mvPhoneSchema,
  storagePathSchema,
} from "./common";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "invalid_color");

/** Site branding: single document `settings/branding`. Admin-editable. */
export const brandingSchema = z.object({
  siteName: localizedTextSchema(60),
  tagline: localizedTextSchema(160).optional(),
  logoPath: storagePathSchema.optional(),
  primaryColor: hexColor,
  accentColor: hexColor,
  contactEmail: z.email().optional(),
  contactPhone: mvPhoneSchema.optional(),
  updatedAt: z.date(),
  updatedBy: idSchema,
});
export type Branding = z.infer<typeof brandingSchema>;

export const DEFAULT_BRANDING: Omit<Branding, "updatedAt" | "updatedBy"> = {
  siteName: { en: "FarmConnect Maldives", dv: "ފާމްކަނެކްޓް ދިވެހިރާއްޖެ" },
  tagline: {
    en: "Fresh produce direct from Maldivian farmers",
    dv: "ދިވެހި ދަނޑުވެރިންގެ އަތުން ތާޒާ ބާޒާރު",
  },
  primaryColor: "#15803d",
  accentColor: "#0e7490",
};

export const AUDIT_ACTIONS = [
  "user.block",
  "user.unblock",
  "user.role_change",
  "listing.remove",
  "listing.restore",
  "farmer.verify",
  "report.update",
  "branding.update",
] as const;

/** Append-only admin action log: `auditLogs/{id}`. Written only by server code. */
export const auditLogSchema = z.object({
  id: idSchema,
  actorId: idSchema,
  action: z.enum(AUDIT_ACTIONS),
  targetType: z.string().max(40),
  targetId: idSchema,
  details: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.date(),
});
export type AuditLog = z.infer<typeof auditLogSchema>;
