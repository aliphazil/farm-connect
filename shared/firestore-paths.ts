/**
 * Collection names in one place, shared by web, server, scripts and a future
 * mobile app. Keep in sync with firebase/firestore.rules and docs/data-model.md.
 *
 * Conventions:
 * - A schema's `id`/`uid` field is the Firestore document id. It is added when
 *   reading and is not stored in the document.
 * - Per-user documents (users, farmerProfiles, consumerProfiles) use the
 *   Firebase Auth uid as their id.
 * - Every document has `createdAt`; mutable documents also have `updatedAt`.
 *   Both are server timestamps.
 * - Ownership fields: `farmerId`, `consumerId`, `userId`, `reporterId`, `actorId`.
 *
 * This file has no imports so scripts can load it directly with Node.
 */
export const COLLECTIONS = {
  users: "users",
  farmerProfiles: "farmerProfiles",
  consumerProfiles: "consumerProfiles",
  products: "products",
  categories: "categories",
  units: "units",
  atolls: "atolls",
  islands: "islands",
  deliveryAreas: "deliveryAreas",
  enquiries: "enquiries",
  favourites: "favourites",
  reports: "reports",
  moderationActions: "moderationActions",
  enforcementActions: "enforcementActions",
  /** Server-only: one doc per reporter + subject while a report is open (duplicate guard). */
  reportGuards: "reportGuards",
  /** Server-only: per-user report submission counters (rate limit). */
  reportQuotas: "reportQuotas",
  orders: "orders",
  invoices: "invoices",
  payments: "payments",
  receipts: "receipts",
  /** Server-only: per-farmer invoice/receipt sequence counters. */
  financeCounters: "financeCounters",
  /** Server-only: one doc per issued document number (global uniqueness guard). */
  documentNumbers: "documentNumbers",
  siteSettings: "siteSettings",
  siteContent: "siteContent",
  /** Legacy raw usage events (before Phase 10); no longer written. */
  siteEvents: "siteEvents",
  /** Daily counters: `{day}` with `shards/{n}` and `hll/{n}` (server only). */
  analyticsDaily: "analyticsDaily",
  /** Per-product and per-farm daily counters (server only). */
  analyticsProductDaily: "analyticsProductDaily",
  analyticsFarmerDaily: "analyticsFarmerDaily",
  /** Short-lived duplicate markers, removed by a TTL policy (server only). */
  analyticsMarks: "analyticsMarks",
  adminLogs: "adminLogs",
  /** Branding Studio: the working draft (admins only). */
  brandingDrafts: "brandingDrafts",
  /** Every published branding version (admins only). */
  brandingVersions: "brandingVersions",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

/** Fixed document ids in `siteSettings`. */
export const SITE_SETTINGS_DOCS = {
  branding: "branding",
  featured: "featured",
  moderation: "moderation",
} as const;

/** `favourites` ids are deterministic so a product or farm can't be saved twice. */
export function favouriteId(
  userId: string,
  targetType: "product" | "farmer",
  targetId: string,
): string {
  return `${userId}_${targetType}_${targetId}`;
}

/** Storage layout. Keep in sync with firebase/storage.rules. */
export const storagePaths = {
  productImage: (farmerId: string, productId: string, fileName: string) =>
    `products/${farmerId}/${productId}/${fileName}`,
  farmerLogo: (farmerId: string, fileName: string) =>
    `farmers/${farmerId}/${fileName}`,
  paymentProof: (farmerId: string, paymentId: string, fileName: string) =>
    `payments/${farmerId}/${paymentId}/${fileName}`,
  brandingAsset: (fileName: string) => `branding/${fileName}`,
  reportEvidence: (reporterId: string, fileName: string) =>
    `reportEvidence/${reporterId}/${fileName}`,
};

export const UPLOAD_LIMITS = {
  imageBytes: 5 * 1024 * 1024,
  imageTypes: ["image/jpeg", "image/png", "image/webp"],
  proofBytes: 5 * 1024 * 1024,
  proofTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  evidenceBytes: 5 * 1024 * 1024,
  evidenceTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
} as const;
