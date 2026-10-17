import { z } from "zod";
import { searchTokens } from "../search";
import {
  MAX_LISTING_IMAGES,
  PRODUCT_CATEGORIES,
  PRODUCT_UNITS,
} from "../constants/catalog";
import {
  atollCodeSchema,
  idSchema,
  laariSchema,
  localizedTextSchema,
  locationSchema,
  storagePathSchema,
  timestampsSchema,
} from "./common";
import { deliveryDestinationSchema } from "./farmer";

/** Lifecycle the farmer controls. */
export const PRODUCT_STATUSES = [
  "draft",
  "active",
  "paused",
  "sold_out",
] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

/** Statuses visible to the public (when not moderated and the farm is public). */
export const PUBLIC_PRODUCT_STATUSES = ["active", "sold_out"] as const;

/**
 * Admin moderation state, separate from the farmer's status.
 * ok: allowed. pending: awaiting review (when listing pre-approval is on).
 * rejected: not approved; the farmer may edit and resubmit (→ pending).
 * removed: taken down; kept as evidence, the farmer can't edit or delete it.
 */
export const PRODUCT_MODERATION = [
  "ok",
  "pending",
  "rejected",
  "removed",
] as const;
export type ProductModeration = (typeof PRODUCT_MODERATION)[number];

/**
 * Product listing: `products/{productId}`.
 *
 * Public read requires: status ∈ PUBLIC_PRODUCT_STATUSES, moderation == "ok"
 * and farmerVisible == true. `farmerVisible` is a denormalised copy of the
 * farm's public state (approved + visible) so public queries need no joins;
 * rules check it against the farm profile on every farmer write, and the
 * server updates it when an admin approves, rejects, blocks or unblocks.
 */
export const productSchema = z
  .object({
    id: idSchema,
    farmerId: idSchema,
    title: localizedTextSchema(100),
    description: localizedTextSchema(2000).optional(),
    category: z.enum(PRODUCT_CATEGORIES),
    unit: z.enum(PRODUCT_UNITS),
    priceLaari: laariSchema.positive(),
    quantityAvailable: z.number().nonnegative().max(1_000_000),
    minOrderQuantity: z.number().positive().max(1_000_000).optional(),
    imagePaths: z.array(storagePathSchema).max(MAX_LISTING_IMAGES),
    /** Copied from the farm profile so the marketplace can filter without joins. */
    location: locationSchema,
    deliveryDestinations: z.array(deliveryDestinationSchema).max(50),
    status: z.enum(PRODUCT_STATUSES),
    moderation: z.enum(PRODUCT_MODERATION),
    /** Admin's note to the farmer for a rejection/removal (server-written). */
    moderationNote: z.string().max(500).optional(),
    farmerVisible: z.boolean(),
    /**
     * Derived (see productDerivedFields): status ∈ PUBLIC_PRODUCT_STATUSES &&
     * moderation == "ok" && farmerVisible. One field makes public queries
     * simple to index; Security Rules check it's computed correctly.
     */
    isPublic: z.boolean(),
    /** Derived word prefixes of the name for search (shared/search.ts). */
    searchTokens: z.array(z.string().max(15)).max(80),
    /** Derived atoll codes this product reaches (own atoll + destinations). */
    deliveryAtolls: z.array(atollCodeSchema).max(21),
    availableFrom: z.date().optional(),
    harvestDate: z.date().optional(),
    /** Buyers may collect from the farm. */
    pickupAvailable: z.boolean().optional(),
  })
  .extend(timestampsSchema.shape);
export type Product = z.infer<typeof productSchema>;

/** What a farmer submits when creating or editing a product. */
export const productInputSchema = productSchema.pick({
  title: true,
  description: true,
  category: true,
  unit: true,
  priceLaari: true,
  quantityAvailable: true,
  minOrderQuantity: true,
  imagePaths: true,
  deliveryDestinations: true,
  status: true,
  availableFrom: true,
  harvestDate: true,
  pickupAvailable: true,
});
export type ProductInput = z.infer<typeof productInputSchema>;

export function isProductPublic(
  p: Pick<Product, "status" | "moderation" | "farmerVisible">,
): boolean {
  return (
    (PUBLIC_PRODUCT_STATUSES as readonly string[]).includes(p.status) &&
    p.moderation === "ok" &&
    p.farmerVisible
  );
}

/** The derived fields every product write must carry (also used in rules tests). */
export function productDerivedFields(p: {
  status: ProductStatus;
  moderation: ProductModeration;
  farmerVisible: boolean;
  title: { en: string; dv?: string };
  location: { atollCode: string };
  deliveryDestinations: { atollCode: string }[];
}) {
  return {
    isPublic: isProductPublic(p),
    searchTokens: searchTokens(p.title.en, p.title.dv),
    deliveryAtolls: [
      ...new Set([
        p.location.atollCode,
        ...p.deliveryDestinations.map((d) => d.atollCode),
      ]),
    ] as Product["deliveryAtolls"],
  };
}
