import { z } from "zod";
import {
  idSchema,
  laariSchema,
  storagePathSchema,
  timestampsSchema,
} from "./common";

/** Offline payments only — no card processing in the first release. */
export const PAYMENT_METHODS = ["cash", "bank_transfer", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Only administrators may move a payment out of "unverified". */
export const PAYMENT_VERIFICATION = [
  "unverified",
  "verified",
  "rejected",
] as const;
export type PaymentVerification = (typeof PAYMENT_VERIFICATION)[number];

/**
 * A payment recorded against an invoice: `payments/{id}`. Recorded via server
 * code on the farmer's behalf; verified by admins. Visible to the farmer, the
 * consumer (if linked) and admins.
 */
export const paymentRecordSchema = z
  .object({
    id: idSchema,
    invoiceId: idSchema,
    farmerId: idSchema,
    consumerId: idSchema.optional(),
    amountLaari: laariSchema.positive(),
    method: z.enum(PAYMENT_METHODS),
    /** Bank transfer reference, receipt number, etc. */
    reference: z.string().trim().max(120).optional(),
    /** Optional transfer slip in Storage (payments/{farmerId}/{paymentId}/…). */
    proofPath: storagePathSchema.optional(),
    receivedAt: z.date(),
    recordedBy: idSchema,
    verificationStatus: z.enum(PAYMENT_VERIFICATION),
    verifiedBy: idSchema.optional(),
    verifiedAt: z.date().optional(),
  })
  .extend(timestampsSchema.shape);
export type PaymentRecord = z.infer<typeof paymentRecordSchema>;

export const paymentInputSchema = paymentRecordSchema.pick({
  invoiceId: true,
  amountLaari: true,
  method: true,
  reference: true,
  receivedAt: true,
});
export type PaymentInput = z.infer<typeof paymentInputSchema>;

/** `receipts/{id}` — issued by the server for a recorded payment. */
export const receiptSchema = z.object({
  id: idSchema,
  /** Sequential per farmer, e.g. "RCT-0001". */
  number: z.string().min(1).max(32),
  paymentId: idSchema,
  invoiceId: idSchema,
  farmerId: idSchema,
  consumerId: idSchema.optional(),
  amountLaari: laariSchema.positive(),
  issuedAt: z.date(),
  createdAt: z.date(),
});
export type Receipt = z.infer<typeof receiptSchema>;
