import { z } from "zod";
import { LOCALES } from "../constants/locales";
import {
  idSchema,
  localizedTextSchema,
  mvPhoneSchema,
  storagePathSchema,
} from "./common";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "invalid_color");

/** `siteSettings/branding` — public, published by admins via server code. */
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

export const brandingInputSchema = brandingSchema.omit({
  updatedAt: true,
  updatedBy: true,
});
export type BrandingInput = z.infer<typeof brandingInputSchema>;

/**
 * `siteSettings/featured` — homepage curation, admin-editable. Kept out of
 * product/farmer documents so owners can't feature themselves.
 */
export const featuredSchema = z.object({
  productIds: z.array(idSchema).max(24),
  farmerIds: z.array(idSchema).max(12),
  updatedAt: z.date(),
  updatedBy: idSchema,
});
export type Featured = z.infer<typeof featuredSchema>;

/**
 * `siteSettings/moderation` — platform moderation switches (owner-editable).
 * When `listingsRequireApproval` is on, new listings start as "pending" and
 * stay hidden until an admin approves them. Rules read this document.
 */
export const moderationSettingsSchema = z.object({
  listingsRequireApproval: z.boolean(),
  /** Users may appeal enforcement actions (default on). */
  appealsEnabled: z.boolean().optional(),
  /**
   * Admins may pause the appeal on a specific action while an investigation
   * is under way, with a recorded justification (default off).
   */
  allowAppealHold: z.boolean().optional(),
  updatedAt: z.date().optional(),
  updatedBy: idSchema.optional(),
});
export type ModerationSettings = z.infer<typeof moderationSettingsSchema>;

/**
 * `siteContent/{key}_{locale}` — editable long-form pages (about, terms, …).
 * Public when published; admin-written via server code.
 */
export const siteContentSchema = z.object({
  id: idSchema,
  key: z.string().regex(/^[a-z][a-z0-9-]{1,40}$/),
  locale: z.enum(LOCALES),
  title: z.string().trim().min(1).max(120),
  intro: z.string().trim().max(500),
  sections: z
    .array(
      z.object({
        heading: z.string().trim().min(1).max(120),
        paragraphs: z.array(z.string().max(4000)).max(20).optional(),
        bullets: z.array(z.string().max(500)).max(30).optional(),
      }),
    )
    .max(30),
  published: z.boolean(),
  draft: z.boolean(),
  updatedAt: z.date(),
  updatedBy: idSchema,
});
export type SiteContent = z.infer<typeof siteContentSchema>;

export const CONTACT_CHANNELS = ["call", "whatsapp", "viber"] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];

export const SITE_EVENT_TYPES = [
  "page_view",
  "product_view",
  "farmer_view",
  "search",
  "contact_click",
] as const;
export type SiteEventType = (typeof SITE_EVENT_TYPES)[number];

/**
 * `siteEvents/{auto}` — legacy raw usage events written by browsers before
 * Phase 10. No longer written (rules refuse new ones); kept for admins.
 * Analytics now go through /api/events (see ./analytics.ts).
 */
export const siteEventSchema = z.object({
  id: idSchema,
  type: z.enum(SITE_EVENT_TYPES),
  locale: z.enum(LOCALES),
  path: z.string().max(200).optional(),
  productId: idSchema.optional(),
  farmerId: idSchema.optional(),
  /** For contact_click: which button. A click is not a delivered message or a sale. */
  channel: z.enum(CONTACT_CHANNELS).optional(),
  uid: idSchema.optional(),
  createdAt: z.date(),
});
export type SiteEvent = z.infer<typeof siteEventSchema>;
