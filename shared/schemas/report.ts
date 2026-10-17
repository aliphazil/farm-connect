import { z } from "zod";
import { idSchema, timestampsSchema } from "./common";

export const REPORT_TARGET_TYPES = ["product", "user", "farmer"] as const;
export const REPORT_REASONS = [
  "fraud_scam",
  "fake_listing",
  "wrong_price_or_quantity",
  "non_delivery",
  "abusive_behaviour",
  "prohibited_item",
  "other",
] as const;
export const REPORT_STATUSES = [
  "open",
  "reviewing",
  "resolved",
  "dismissed",
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/**
 * Fraud / abuse report: `reports/{id}`. Created by any active signed-in user;
 * visible only to the reporter and admins; updated only by server code.
 */
export const fraudReportSchema = z
  .object({
    id: idSchema,
    reporterId: idSchema,
    targetType: z.enum(REPORT_TARGET_TYPES),
    targetId: idSchema,
    reason: z.enum(REPORT_REASONS),
    details: z.string().trim().min(10).max(2000),
    status: z.enum(REPORT_STATUSES),
    resolution: z.string().max(2000).optional(),
    handledBy: idSchema.optional(),
  })
  .extend(timestampsSchema.shape);
export type FraudReport = z.infer<typeof fraudReportSchema>;

export const fraudReportInputSchema = fraudReportSchema.pick({
  targetType: true,
  targetId: true,
  reason: true,
  details: true,
});
export type FraudReportInput = z.infer<typeof fraudReportInputSchema>;

export const MODERATION_ACTIONS = [
  "user.block",
  "user.unblock",
  "user.suspend",
  "user.restore",
  "user.restrict",
  "farmer.approve",
  "farmer.reject",
  "farmer.verify",
  "product.approve",
  "product.reject",
  "product.remove",
  "product.restore",
  "product.deactivate",
  "report.review",
  "report.resolve",
  "report.dismiss",
] as const;
export type ModerationActionType = (typeof MODERATION_ACTIONS)[number];

/**
 * `moderationActions/{id}` — what an admin did to a user or piece of content,
 * and why. Append-only, server-written, admin-readable.
 */
export const moderationActionSchema = z.object({
  id: idSchema,
  actorId: idSchema,
  action: z.enum(MODERATION_ACTIONS),
  targetType: z.enum(["user", "farmer", "product", "report"]),
  targetId: idSchema,
  reason: z.string().max(1000).optional(),
  reportId: idSchema.optional(),
  /** End of a suspension, when the action is one. */
  until: z.date().optional(),
  /** Restrictions in force after a user.restrict action. */
  restrictions: z.array(z.string().max(40)).max(10).optional(),
  createdAt: z.date(),
});
export type ModerationAction = z.infer<typeof moderationActionSchema>;
