import { z } from "zod";
import { ACCOUNT_RESTRICTIONS } from "../constants/admin";
import { idSchema } from "./common";

export const ENFORCEMENT_TYPES = [
  "warning",
  "restriction",
  "suspension",
  "block",
] as const;
export type EnforcementType = (typeof ENFORCEMENT_TYPES)[number];

/**
 * active: in force. expired: a suspension that ran out. lifted: an admin
 * restored the account or removed the restriction. overturned: lifted
 * because an appeal succeeded.
 */
export const ENFORCEMENT_STATUSES = [
  "active",
  "expired",
  "lifted",
  "overturned",
] as const;
export type EnforcementStatus = (typeof ENFORCEMENT_STATUSES)[number];

export const APPEAL_STATUSES = [
  "none",
  "pending",
  "upheld",
  "overturned",
] as const;
export type AppealStatus = (typeof APPEAL_STATUSES)[number];

/**
 * `enforcementActions/{id}` — every warning, restriction, suspension and
 * block, with the reason shown to the user, the administrator, dates, expiry
 * and the appeal. Server-written; admins read it directly, users only through
 * server code that leaves out `internalNote` and admin ids.
 */
export const enforcementActionSchema = z.object({
  id: idSchema,
  userId: idSchema,
  type: z.enum(ENFORCEMENT_TYPES),
  /** Shown to the user. Must not reveal who reported them. */
  reason: z.string().trim().min(3).max(1000),
  /** Admin-only context. */
  internalNote: z.string().max(2000).optional(),
  restrictions: z.array(z.enum(ACCOUNT_RESTRICTIONS)).max(10).optional(),
  reportId: idSchema.optional(),
  createdBy: idSchema,
  createdAt: z.date(),
  expiresAt: z.date().optional(),
  status: z.enum(ENFORCEMENT_STATUSES),
  endedAt: z.date().optional(),
  endedBy: idSchema.optional(),
  endReason: z.string().max(1000).optional(),
  appeal: z.object({
    status: z.enum(APPEAL_STATUSES),
    /** Appeals paused while an investigation runs (allowed only if policy permits). */
    heldUntilDecision: z.boolean().optional(),
    heldReason: z.string().max(500).optional(),
    message: z.string().max(2000).optional(),
    submittedAt: z.date().optional(),
    decidedBy: idSchema.optional(),
    decidedAt: z.date().optional(),
    /** Shown to the user. */
    outcomeNote: z.string().max(1000).optional(),
  }),
});
export type EnforcementAction = z.infer<typeof enforcementActionSchema>;

export const appealInputSchema = z.object({
  actionId: idSchema,
  message: z.string().trim().min(20).max(2000),
});
export type AppealInput = z.infer<typeof appealInputSchema>;
