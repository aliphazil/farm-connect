import { z } from "zod";
import { ATOLL_CODES } from "../constants/geography";
import { normalizeMvPhone } from "../utils/phone";

export const idSchema = z.string().min(1).max(128);

/** Firestore Timestamps are converted to Date at the data-access layer. */
export const timestampsSchema = z.object({
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const localizedTextSchema = (max: number) =>
  z.object({
    en: z.string().trim().min(1).max(max),
    dv: z.string().trim().max(max).optional(),
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
  /** Island id from the `islands` collection / SEED_ISLANDS. */
  islandId: idSchema,
});
export type Location = z.infer<typeof locationSchema>;

/** Storage object path (not a download URL), e.g. "listings/{uid}/{listingId}/a.jpg". */
export const storagePathSchema = z.string().min(1).max(512);
