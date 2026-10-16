import { z } from "zod";
import {
  LISTING_STATUSES,
  MAX_LISTING_IMAGES,
  PRODUCT_CATEGORIES,
  PRODUCT_UNITS,
} from "../constants/catalog";
import {
  idSchema,
  laariSchema,
  localizedTextSchema,
  locationSchema,
  storagePathSchema,
  timestampsSchema,
} from "./common";
import { deliveryDestinationSchema } from "./farmer";

/** Product listing: `listings/{listingId}`. */
export const listingSchema = z
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
    /** Copied from the farmer profile so the marketplace can filter without joins. */
    location: locationSchema,
    deliveryDestinations: z.array(deliveryDestinationSchema).max(50),
    status: z.enum(LISTING_STATUSES),
    /** Harvest/availability date, if the farmer gives one. */
    availableFrom: z.date().optional(),
  })
  .extend(timestampsSchema.shape);
export type Listing = z.infer<typeof listingSchema>;

/** What a farmer submits when creating or editing a listing. */
export const listingInputSchema = listingSchema
  .pick({
    title: true,
    description: true,
    category: true,
    unit: true,
    priceLaari: true,
    quantityAvailable: true,
    minOrderQuantity: true,
    deliveryDestinations: true,
    availableFrom: true,
  })
  .extend({ status: z.enum(["draft", "active", "paused", "sold_out"]) });
export type ListingInput = z.infer<typeof listingInputSchema>;
