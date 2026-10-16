import { z } from "zod";
import { idSchema, laariSchema, timestampsSchema } from "./common";

/** Offline payments only — no card processing in the first release. */
export const PAYMENT_METHODS = ["cash", "bank_transfer", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** A payment the farmer has received against an invoice: `payments/{id}`. */
export const paymentRecordSchema = z
  .object({
    id: idSchema,
    invoiceId: idSchema,
    farmerId: idSchema,
    amountLaari: laariSchema.positive(),
    method: z.enum(PAYMENT_METHODS),
    /** Bank transfer reference, receipt number, etc. */
    reference: z.string().trim().max(120).optional(),
    receivedAt: z.date(),
    recordedBy: idSchema,
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
