import { z } from "zod";
import {
  DELIVERY_METHODS,
  PRODUCT_CATEGORIES,
  PRODUCT_UNITS,
} from "../constants/catalog";
import {
  atollCodeSchema,
  idSchema,
  laariSchema,
  localizedTextSchema,
  timestampsSchema,
} from "./common";

/** `categories/{category}` — public reference data, admin-maintained. */
export const categorySchema = z.object({
  id: z.enum(PRODUCT_CATEGORIES),
  label: localizedTextSchema(60),
  icon: z.string().max(8),
  sortOrder: z.number().int(),
  active: z.boolean(),
});
export type Category = z.infer<typeof categorySchema>;

/**
 * `units/{unit}` — public reference data, admin-maintained. Unit ids are
 * fixed in code (rules, schemas, translations); admins edit the labels and
 * whether a unit can be chosen for new listings.
 */
export const unitSchema = z.object({
  id: z.enum(PRODUCT_UNITS),
  label: localizedTextSchema(40),
  sortOrder: z.number().int(),
  active: z.boolean(),
});
export type Unit = z.infer<typeof unitSchema>;

/** Admin edit of a category or unit: labels (blank = default) and availability. */
export const referenceLabelInputSchema = z.object({
  labelEn: z.string().trim().max(60),
  labelDv: z.string().trim().max(60),
  active: z.boolean(),
});
export type ReferenceLabelInput = z.infer<typeof referenceLabelInputSchema>;

/** Admin add/edit of an island. The id is derived once and never changes. */
export const islandInputSchema = z.object({
  atollCode: atollCodeSchema,
  nameEn: z.string().trim().min(2).max(60),
  nameDv: z.string().trim().max(60),
  active: z.boolean(),
});
export type IslandInput = z.infer<typeof islandInputSchema>;

/** `atolls/{code}` — public reference data. */
export const atollDocSchema = z.object({
  id: atollCodeSchema,
  abbr: z.string().max(8),
  abbrDv: z.string().max(8),
  nameEn: z.string().max(60),
  nameDv: z.string().max(60),
  sortOrder: z.number().int(),
});
export type AtollDoc = z.infer<typeof atollDocSchema>;

/** `islands/{islandId}` — public reference data. */
export const islandDocSchema = z.object({
  id: idSchema,
  atollCode: atollCodeSchema,
  nameEn: z.string().max(60),
  nameDv: z.string().max(60).optional(),
  active: z.boolean(),
});
export type IslandDoc = z.infer<typeof islandDocSchema>;

/**
 * `deliveryAreas/{id}` — a farmer's delivery terms for one atoll or island.
 * Farmer-owned. `farmerProfiles.deliveryDestinations` keeps a summary for
 * filtering; services update both together.
 */
export const deliveryAreaSchema = z
  .object({
    id: idSchema,
    farmerId: idSchema,
    atollCode: atollCodeSchema,
    islandId: idSchema.optional(),
    method: z.enum(DELIVERY_METHODS),
    feeLaari: laariSchema.optional(),
    minOrderLaari: laariSchema.optional(),
    notes: z.string().trim().max(300).optional(),
    active: z.boolean(),
  })
  .extend(timestampsSchema.shape);
export type DeliveryArea = z.infer<typeof deliveryAreaSchema>;

export const deliveryAreaInputSchema = deliveryAreaSchema.pick({
  atollCode: true,
  islandId: true,
  method: true,
  feeLaari: true,
  minOrderLaari: true,
  notes: true,
  active: true,
});
export type DeliveryAreaInput = z.infer<typeof deliveryAreaInputSchema>;
