import { z } from "zod";
import {
  idSchema,
  laariSchema,
  storagePathSchema,
  timestampsSchema,
} from "./common";

/**
 * Offline payment methods recorded by farmers. FarmConnect doesn't process
 * payments. Add methods here (and to the dictionaries) to configure more.
 */
export const PAYMENT_METHODS = [
  "cash",
  "bank_transfer",
  "mobile_wallet",
  "cheque",
  "other",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Methods with a bank/wallet trail an administrator can check. */
export const VERIFIABLE_METHODS: readonly PaymentMethod[] = [
  "bank_transfer",
  "mobile_wallet",
  "cheque",
];

export const LEDGER_KINDS = ["payment", "refund", "reversal"] as const;
export type LedgerKind = (typeof LEDGER_KINDS)[number];

/**
 * recorded: entered by the seller (their own statement). pending_verification:
 * seller-recorded transfer awaiting an administrator's check. verified: an
 * administrator checked the evidence. rejected: an administrator found it
 * invalid (doesn't count). Older records used "unverified" (= recorded).
 */
export const PAYMENT_VERIFICATION = [
  "recorded",
  "pending_verification",
  "verified",
  "rejected",
] as const;
export type PaymentVerification = (typeof PAYMENT_VERIFICATION)[number];

/**
 * `payments/{id}` — the append-only ledger: payments, refunds and reversals
 * against an invoice. Entries are never deleted; a mistake is corrected with
 * a reversal (which cancels the entry it points to) or a refund. Server-written;
 * visible to the farmer, the linked buyer and admins.
 */
export const paymentRecordSchema = z
  .object({
    id: idSchema,
    invoiceId: idSchema,
    orderId: idSchema.optional(),
    farmerId: idSchema,
    consumerId: idSchema.optional(),
    kind: z.enum(LEDGER_KINDS).default("payment"),
    amountLaari: laariSchema.positive(),
    /** Signed effect on the amount paid (shared/ledger.ts effectiveAmount). */
    effectiveLaari: z.number().int().optional(),
    currency: z.literal("MVR").default("MVR"),
    method: z.enum(PAYMENT_METHODS),
    /** Bank transfer reference, cheque number, etc. */
    reference: z.string().trim().max(120).optional(),
    /** Transfer slip in Storage (payments/{farmerId}/…). */
    proofPath: storagePathSchema.optional(),
    /** Payment date. */
    receivedAt: z.date(),
    recordedBy: idSchema,
    recordedByRole: z.enum(["farmer", "admin"]).optional(),
    notes: z.string().max(500).optional(),
    verificationStatus: z.preprocess(
      (v) => (v === "unverified" ? "recorded" : v),
      z.enum(PAYMENT_VERIFICATION),
    ),
    verifiedBy: idSchema.optional(),
    verifiedAt: z.date().optional(),
    verificationNote: z.string().max(500).optional(),
    /** On a reversal: the entry it cancels. */
    reversesId: idSchema.optional(),
    /** On a cancelled entry: the reversal that cancelled it. */
    reversedBy: idSchema.optional(),
    reversed: z.boolean().optional(),
    reason: z.string().max(500).optional(),
    receiptId: idSchema.optional(),
  })
  .extend(timestampsSchema.shape);
export type PaymentRecord = z.infer<typeof paymentRecordSchema>;

export const paymentInputSchema = z.object({
  amountLaari: laariSchema.positive(),
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().trim().max(120).optional(),
  receivedAt: z.date(),
  notes: z.string().trim().max(500).optional(),
  proofPath: z.string().max(300).optional(),
});
export type PaymentInput = z.infer<typeof paymentInputSchema>;

/** `receipts/{id}` — issued by the server for each payment or refund. */
export const receiptSchema = z.object({
  id: idSchema,
  /** Globally unique, e.g. "RCT-ABC123-0001". */
  number: z.string().min(1).max(40),
  paymentId: idSchema,
  invoiceId: idSchema,
  farmerId: idSchema,
  consumerId: idSchema.optional(),
  kind: z.enum(["payment", "refund"]).default("payment"),
  amountLaari: laariSchema.positive(),
  currency: z.literal("MVR").default("MVR"),
  issuedAt: z.date(),
  createdAt: z.date(),
});
export type Receipt = z.infer<typeof receiptSchema>;
