import { z } from "zod";
import { PRODUCT_CATEGORIES } from "../constants/catalog";
import { ATOLL_CODES } from "../constants/geography";
import { idSchema } from "./common";
import { CONTACT_CHANNELS } from "./site";

/**
 * Marketplace analytics: the events the browser may report and how each is
 * counted. Raw events are never stored. The server validates each one, drops
 * duplicates and adds it to daily counters (src/services/server/analytics.ts).
 *
 * Definitions (all days are calendar days in Maldives time, UTC+5):
 * - Visitor: one browser. A random id kept in that browser's local storage —
 *   not a cookie, not linked to an account. Refreshing or coming back the
 *   same day is the same visitor. Clearing site data, private windows and
 *   other devices look like new visitors.
 * - Session (visit): starts on the first page, or after 30 minutes without
 *   activity, or at Maldives midnight.
 * - Page view: every public page shown, including refreshes. Admin, farmer
 *   and account pages aren't counted.
 * - Product view / farmer profile view: a visitor opening a product or farm
 *   page; the same visitor and page count once per day.
 * - Search: a product search with words; the same words by the same visitor
 *   count once per day.
 * - Filter use: a category, atoll or island filter applied on the product
 *   list (or a category page opened); once per visitor, filter and day.
 * - Contact click: a tap on Call, WhatsApp or Viber. It means the buyer's
 *   phone or chat app was opened — not that a message was sent or delivered,
 *   or that a sale happened. Once per visitor, button and listing per day.
 *
 * Counted from the records themselves (not from browser events):
 * enquiries created, farmer and buyer registrations, invoices issued,
 * payment records created (recorded ≠ verified), reports and enforcement.
 */

export const ANALYTICS_SHARDS = 5;
/** Longest custom range on the dashboards. */
export const ANALYTICS_MAX_DAYS = 366;
/** Session timeout used by the browser tracker. */
export const SESSION_IDLE_MS = 30 * 60 * 1000;
/** Dedupe markers are kept this long, then removed by a Firestore TTL policy. */
export const MARK_TTL_DAYS = 3;

const visitorId = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/);

/** Public pages only: /en or /dv paths, never portal pages. */
const PRIVATE_PREFIX =
  /^\/(en|dv)\/(admin|farmer|account|preview|documents)(\/|$)/;
export const trackablePathSchema = z
  .string()
  .max(200)
  .regex(/^\/(en|dv)(\/[A-Za-z0-9._~%-]*)*$/)
  .refine((p) => !PRIVATE_PREFIX.test(p), "private_path");

export function isTrackablePath(path: string): boolean {
  return trackablePathSchema.safeParse(path).success;
}

export const analyticsEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("page_view"), path: trackablePathSchema }),
  z.object({ type: z.literal("product_view"), productId: idSchema }),
  z.object({ type: z.literal("farmer_view"), farmerId: idSchema }),
  z.object({
    type: z.literal("search"),
    /** Used only to drop repeats (hashed); never stored. */
    q: z.string().trim().min(1).max(100),
    noResults: z.boolean(),
  }),
  z.object({
    type: z.literal("filter"),
    category: z.enum(PRODUCT_CATEGORIES).optional(),
    atoll: z.enum(ATOLL_CODES).optional(),
    island: idSchema.optional(),
  }),
  z.object({
    type: z.literal("contact_click"),
    channel: z.enum(CONTACT_CHANNELS),
    productId: idSchema.optional(),
    farmerId: idSchema.optional(),
  }),
]);
export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>;

export const analyticsBatchSchema = z.object({
  /** Browser's random visitor id (hashed on the server, never stored). */
  v: visitorId,
  /** Random session id (hashed, never stored). */
  s: visitorId,
  /** The browser hasn't reported this visitor today yet. */
  newDay: z.boolean().optional(),
  /** The browser started a new session. */
  newSession: z.boolean().optional(),
  events: z.array(analyticsEventSchema).min(1).max(5),
});
export type AnalyticsBatch = z.infer<typeof analyticsBatchSchema>;

/** Counter names in `analyticsDaily/{day}/shards/{n}.counts`. */
export const DAILY_COUNTERS = [
  "visitors",
  "sessions",
  "pageViews",
  "productViews",
  "farmerViews",
  "searches",
  "searchesNoResults",
  "filterUses",
  "contactClicks",
  "contactCall",
  "contactWhatsapp",
  "contactViber",
] as const;
export type DailyCounter = (typeof DAILY_COUNTERS)[number];

/** Per-key tallies in the shard documents (top products, categories, …). */
export const DAILY_TALLIES = [
  "productViews",
  "productClicks",
  "farmerViews",
  "categoryViews",
  "islandViews",
  "categoryFilters",
  "atollFilters",
  "islandFilters",
] as const;
export type DailyTally = (typeof DAILY_TALLIES)[number];

/** `analyticsProductDaily/{day}_{productId}` and `analyticsFarmerDaily/{day}_{farmerId}`. */
export const entityDailySchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  farmerId: idSchema,
  productId: idSchema.optional(),
  productViews: z.number().int().nonnegative().default(0),
  profileViews: z.number().int().nonnegative().default(0),
  contactClicks: z.number().int().nonnegative().default(0),
  contactCall: z.number().int().nonnegative().default(0),
  contactWhatsapp: z.number().int().nonnegative().default(0),
  contactViber: z.number().int().nonnegative().default(0),
});
export type EntityDaily = z.infer<typeof entityDailySchema>;
