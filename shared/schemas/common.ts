import { z } from "zod";
import { ATOLL_CODES } from "../constants/geography";
import { normalizeMvPhone } from "../utils/phone";

export const idSchema = z.string().min(1).max(128);

/** Firestore Timestamps are converted to Date at the data-access layer. */
export const timestampsSchema = z.object({
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Text in English and/or Dhivehi: at least one must be non-empty. `en` is
 * always present (possibly "") so documents keep a stable shape.
 */
export const localizedTextSchema = (max: number) =>
  z
    .object({
      en: z.string().trim().max(max),
      dv: z.string().trim().max(max).optional(),
    })
    .refine((t) => t.en.length > 0 || (t.dv ?? "").length > 0, {
      message: "required",
      path: ["en"],
    });

/** Integer laari (1 MVR = 100 laari). */
export const laariSchema = z.number().int().nonnegative().max(100_000_000_00);

export const atollCodeSchema = z.enum(ATOLL_CODES);

/** Accepts common local formats, outputs E.164 ("+9607771234"). */
export const mvPhoneSchema = z.string().transform((value, ctx) => {
  const normalized = normalizeMvPhone(value);
  if (!normalized) {
    ctx.addIssue({ code: "custom", message: "invalid_phone" });
    return z.NEVER;
  }
  return normalized;
});

export const locationSchema = z.object({
  atollCode: atollCodeSchema,
  /** Island id from the `islands` collection. */
  islandId: idSchema,
});
export type Location = z.infer<typeof locationSchema>;

/**
 * Optional pin for a farm. Bounds cover the Maldives with a margin
 * (latitude about -0.7 to 7.1, longitude about 72.6 to 73.8).
 */
export const mapLocationSchema = z.object({
  lat: z.number().min(-1).max(8),
  lng: z.number().min(72).max(74.5),
});
export type MapLocation = z.infer<typeof mapLocationSchema>;

/** Storage object path (not a download URL), e.g. "products/{uid}/{productId}/a.jpg". */
export const storagePathSchema = z.string().min(1).max(512);
